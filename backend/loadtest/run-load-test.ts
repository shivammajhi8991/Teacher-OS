/**
 * Phase 6 — "Load testing on attendance-bulk-mark and invoice-generation endpoints
 * specifically (the two highest write-volume paths at term-start/month-start)" (docs/07
 * Phase 6). Hand-rolled rather than autocannon/k6: both endpoints need real seeded data (a
 * teacher, classes, enrolled students, a fee structure) created through the actual API first,
 * and the concurrency/latency measurement needed here is simple enough that a load-testing
 * framework wouldn't simplify anything — matches this project's established
 * dependency-light-when-simple-suffices preference (Reports' CSV writer, CSV import's parser).
 *
 * "Term-start/month-start" names TWO distinct real-world load shapes, both exercised here:
 *   A) one class with an unusually large roster (a big lecture-style class taking attendance,
 *      or a large cohort's invoices all generated in one call)
 *   B) many classes' teachers/admins all doing the same thing within the same few minutes
 *      (every class takes attendance around its own start time each morning; every class's
 *      invoices get generated in the same admin session at month-start)
 *
 * Usage (from backend/, with the dev server + Postgres + Redis already running):
 *   npx ts-node -r tsconfig-paths/register loadtest/run-load-test.ts
 *
 * This seeds real rows into whatever database DATABASE_URL points at — run it against a local
 * dev database, never production. Every row is tagged with a per-run id in its name/email so
 * repeated runs never collide, but nothing here cleans up after itself.
 */

import { execFile } from 'child_process';

const BASE_URL =
  process.env.LOAD_TEST_BASE_URL ?? 'http://localhost:3000/api/v1';
const RUN_ID = Date.now().toString(36);

interface LatencySample {
  ok: boolean;
  ms: number;
  status: number;
}

async function timeRequest(
  fn: () => Promise<Response>,
): Promise<LatencySample> {
  const start = performance.now();
  try {
    const res = await fn();
    const ms = performance.now() - start;
    if (!res.ok) {
      // Drain the body so a failed request's connection is freed for reuse under concurrency.
      await res.text().catch(() => undefined);
    }
    return { ok: res.ok, ms, status: res.status };
  } catch {
    return { ok: false, ms: performance.now() - start, status: 0 };
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(
    sorted.length - 1,
    Math.ceil((p / 100) * sorted.length) - 1,
  );
  return sorted[Math.max(0, idx)];
}

function report(label: string, samples: LatencySample[]): void {
  const latencies = samples.map((s) => s.ms).sort((a, b) => a - b);
  const failures = samples.filter((s) => !s.ok);
  console.log(`\n=== ${label} ===`);
  console.log(`requests: ${samples.length}, failures: ${failures.length}`);
  if (failures.length > 0) {
    const statusCounts = new Map<number, number>();
    for (const f of failures)
      statusCounts.set(f.status, (statusCounts.get(f.status) ?? 0) + 1);
    console.log(
      `failure statuses: ${JSON.stringify(Object.fromEntries(statusCounts))}`,
    );
  }
  console.log(
    `p50: ${percentile(latencies, 50).toFixed(0)}ms  ` +
      `p95: ${percentile(latencies, 95).toFixed(0)}ms  ` +
      `p99: ${percentile(latencies, 99).toFixed(0)}ms  ` +
      `max: ${(latencies[latencies.length - 1] ?? 0).toFixed(0)}ms`,
  );
}

async function api(
  path: string,
  opts: RequestInit & { token?: string } = {},
): Promise<Response> {
  const { token, headers, ...rest } = opts;
  return fetch(`${BASE_URL}${path}`, {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
  });
}

async function must(res: Response, what: string): Promise<Response> {
  if (!res.ok) {
    throw new Error(`${what} failed: ${res.status} ${await res.text()}`);
  }
  return res;
}

// docs/04 §4.8's now-per-user rate limiting (Phase 6 security review) means each identity has
// its own 100-req/60s budget — a single shared teacher issuing every setup call in one script
// would trip its OWN limiter well before "many concurrent classes" ever fires a real request.
// Registering one teacher per class for scenario B isn't a workaround for that; it's the more
// accurate model of the real scenario anyway (many different teachers, not one teacher scripting
// hundreds of calls). One shared teacher is still used for scenario A, since a single large
// roster genuinely is one teacher's own class.
let teacherCounter = 0;

async function registerTeacherAndCompleteOnboarding(
  categoryId: string,
): Promise<string> {
  const suffix = teacherCounter++;
  const registerRes = await must(
    await api('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        fullName: 'Load Test Teacher',
        email: `loadtest-${RUN_ID}-${suffix}@example.com`,
        password: 'correct-horse-battery-staple',
        deviceId: `loadtest-device-${RUN_ID}-${suffix}`,
        role: 'teacher',
      }),
    }),
    'register',
  );
  const token = (await registerRes.json()).tokens.accessToken as string;

  await must(
    await api('/teacher-profiles', {
      method: 'POST',
      token,
      body: JSON.stringify({
        teacherCategoryId: categoryId,
        teachingMode: 'both',
      }),
    }),
    'create teacher profile',
  );
  return token;
}

async function fetchFirstTeacherCategoryId(): Promise<string> {
  const res = await must(await api('/teacher-categories'), 'list categories');
  const categories = (await res.json()) as Array<{ id: string }>;
  return categories[0].id;
}

async function createStudent(token: string, index: number): Promise<string> {
  const res = await must(
    await api('/students', {
      method: 'POST',
      token,
      body: JSON.stringify({
        fullName: `Load Test Student ${RUN_ID}-${index}`,
      }),
    }),
    'create student',
  );
  return (await res.json()).id;
}

async function createClassWithRoster(
  token: string,
  classIndex: number,
  studentIds: string[],
): Promise<string> {
  const classRes = await must(
    await api('/classes', {
      method: 'POST',
      token,
      body: JSON.stringify({
        name: `Load Test Class ${RUN_ID}-${classIndex}`,
        mode: 'offline',
        startDate: '2026-01-01',
      }),
    }),
    'create class',
  );
  const classId = (await classRes.json()).id as string;

  for (const studentId of studentIds) {
    await must(
      await api(`/classes/${classId}/enrollments`, {
        method: 'POST',
        token,
        body: JSON.stringify({ studentId }),
      }),
      'enroll student',
    );
  }

  await must(
    await api('/fee-structures', {
      method: 'POST',
      token,
      body: JSON.stringify({ classId, billingModel: 'monthly', amount: 1000 }),
    }),
    'create fee structure',
  );

  return classId;
}

function bulkMarkAttendance(
  token: string,
  classId: string,
  date: string,
  studentIds: string[],
): Promise<LatencySample> {
  return timeRequest(() =>
    api(`/classes/${classId}/attendance/${date}/bulk`, {
      method: 'POST',
      token,
      body: JSON.stringify({
        records: studentIds.map((studentId) => ({
          studentId,
          status: 'present',
        })),
      }),
    }),
  );
}

function generateInvoices(
  token: string,
  classId: string,
  periodStart: string,
  periodEnd: string,
  dueDate: string,
): Promise<LatencySample> {
  return timeRequest(() =>
    api('/invoices/generate', {
      method: 'POST',
      token,
      body: JSON.stringify({
        classId,
        billingPeriodStart: periodStart,
        billingPeriodEnd: periodEnd,
        dueDate,
      }),
    }),
  );
}

async function main(): Promise<void> {
  console.log(`Load test run ${RUN_ID} against ${BASE_URL}`);
  const categoryId = await fetchFirstTeacherCategoryId();

  // ---------------------------------------------------------------- Scenario A: one big roster
  // 45, not 100: large enough to be a genuinely oversized class roster, small enough that this
  // one teacher's own setup calls (45 students + 45 enrollments + 1 class + 1 fee structure = 92)
  // stay under their own 100-req/60s budget — see the per-user-tracking note above.
  const LARGE_ROSTER_SIZE = 45;
  const scenarioATeacherToken =
    await registerTeacherAndCompleteOnboarding(categoryId);
  console.log(
    `\nSeeding scenario A: 1 class with ${LARGE_ROSTER_SIZE} enrolled students...`,
  );
  const largeRosterStudentIds: string[] = [];
  for (let i = 0; i < LARGE_ROSTER_SIZE; i++) {
    largeRosterStudentIds.push(await createStudent(scenarioATeacherToken, i));
  }
  const largeClassId = await createClassWithRoster(
    scenarioATeacherToken,
    0,
    largeRosterStudentIds,
  );

  const scenarioASamples: LatencySample[] = [];
  for (let round = 0; round < 5; round++) {
    const date = `2026-02-${String(round + 1).padStart(2, '0')}`;
    scenarioASamples.push(
      await bulkMarkAttendance(
        scenarioATeacherToken,
        largeClassId,
        date,
        largeRosterStudentIds,
      ),
    );
  }
  report(
    `Attendance bulk-mark — 1 class, ${LARGE_ROSTER_SIZE} students (5 sequential calls)`,
    scenarioASamples,
  );

  const invoiceScenarioASamples: LatencySample[] = [];
  for (let round = 0; round < 3; round++) {
    const start = `2026-0${round + 3}-01`;
    const end = `2026-0${round + 3}-28`;
    invoiceScenarioASamples.push(
      await generateInvoices(
        scenarioATeacherToken,
        largeClassId,
        start,
        end,
        end,
      ),
    );
  }
  report(
    `Invoice generation — 1 class, ${LARGE_ROSTER_SIZE} students (3 sequential calls)`,
    invoiceScenarioASamples,
  );

  // ------------------------------------------------------- Scenario B: many concurrent classes
  // One teacher per class — the real shape of "many classes at term-start" (many different
  // teachers, each starting their own class around the same time), and it keeps each identity's
  // setup calls (20 students + 1 class + 20 enrollments + 1 fee structure = 42) well under its
  // own rate-limit budget.
  const CONCURRENT_CLASSES = 25;
  const ROSTER_PER_CLASS = 20;
  console.log(
    `\nSeeding scenario B: ${CONCURRENT_CLASSES} teachers, ` +
      `1 class each with ${ROSTER_PER_CLASS} students...`,
  );
  // POST /auth/register carries its own stricter, IP-scoped @Throttle (10/60s, docs/04 §4.3) on
  // top of the per-user global default — correctly IP-tracked rather than per-user, since there's
  // no user yet to scope by. That's the right production behavior (anti-abuse on the single most
  // attacked unauthenticated route) but means this script, registering many synthetic teachers
  // from one IP in a burst, must pace itself rather than firing all registrations at once — a
  // real institute's teachers register once each over the platform's whole lifetime, never in a
  // synchronized burst, so this pacing is purely a load-test-harness concern, not a production one.
  const REGISTER_BATCH_SIZE = 9; // stays under the 10/60s cap with margin
  const scenarioB: Array<{
    token: string;
    classId: string;
    studentIds: string[];
  }> = [];
  for (let c = 0; c < CONCURRENT_CLASSES; c++) {
    if (c > 0 && c % REGISTER_BATCH_SIZE === 0) {
      console.log(
        `  (pausing 61s so the next batch of registrations clears auth's own 10/60s per-IP throttle...)`,
      );
      await sleep(61_000);
    }
    const token = await registerTeacherAndCompleteOnboarding(categoryId);
    const studentIds: string[] = [];
    for (let i = 0; i < ROSTER_PER_CLASS; i++) {
      studentIds.push(await createStudent(token, i));
    }
    const classId = await createClassWithRoster(token, c, studentIds);
    scenarioB.push({ token, classId, studentIds });
  }

  console.log(
    `\nFiring ${CONCURRENT_CLASSES} concurrent attendance bulk-mark calls ` +
      '(every class taking attendance at the same class-start time)...',
  );
  const concurrentAttendanceSamples = await Promise.all(
    scenarioB.map(({ token, classId, studentIds }) =>
      bulkMarkAttendance(token, classId, '2026-03-01', studentIds),
    ),
  );
  report(
    `Attendance bulk-mark — ${CONCURRENT_CLASSES} concurrent classes x ${ROSTER_PER_CLASS} students`,
    concurrentAttendanceSamples,
  );

  // Diagnostic cross-check: Node's global `fetch` (undici) pools connections per origin, so a
  // near-identical latency across all N concurrent samples could mean the CLIENT serialized
  // requests, not the server. Re-fire the same batch through independent `curl` subprocesses —
  // no shared connection pool between them — against a fresh date so it's real work again, and
  // compare the total wall-clock time of the whole batch either way.
  const curlBatchStart = performance.now();
  await Promise.all(
    scenarioB.map(
      ({ token, classId, studentIds }) =>
        new Promise<void>((resolve, reject) => {
          const body = JSON.stringify({
            records: studentIds.map((studentId) => ({
              studentId,
              status: 'present',
            })),
          });
          execFile(
            'curl',
            [
              '-s',
              '-o',
              'NUL',
              '-X',
              'POST',
              `${BASE_URL}/classes/${classId}/attendance/2026-03-02/bulk`,
              '-H',
              `Authorization: Bearer ${token}`,
              '-H',
              'Content-Type: application/json',
              '-d',
              body,
            ],
            (err) => (err ? reject(err) : resolve()),
          );
        }),
    ),
  );
  console.log(
    `Cross-check via ${CONCURRENT_CLASSES} independent curl subprocesses (no shared client ` +
      `connection pool): whole batch took ${(performance.now() - curlBatchStart).toFixed(0)}ms`,
  );

  console.log(
    `\nFiring ${CONCURRENT_CLASSES} concurrent invoice-generation calls ` +
      '(month-start batch billing across every class)...',
  );
  const concurrentInvoiceSamples = await Promise.all(
    scenarioB.map(({ token, classId }) =>
      generateInvoices(
        token,
        classId,
        '2026-04-01',
        '2026-04-30',
        '2026-04-30',
      ),
    ),
  );
  report(
    `Invoice generation — ${CONCURRENT_CLASSES} concurrent classes x ${ROSTER_PER_CLASS} students`,
    concurrentInvoiceSamples,
  );

  console.log('\nDone.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
