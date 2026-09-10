import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AttendanceAuditLog } from '../attendance/entities/attendance-audit-log.entity';
import { PaymentAuditLog } from '../fees/entities/payment-audit-log.entity';
import { AuthenticatedUser } from '../../common/interfaces/request-with-user.interface';

export interface AuditLogEntry {
  id: string;
  source: 'attendance' | 'payment';
  previousStatus: string;
  newStatus: string;
  changedByName: string | null;
  changedAt: Date;
  note: string | null;
}

export interface AuditLogPage {
  entries: AuditLogEntry[];
  nextCursor: string | null;
}

// docs/04 §4.4 "Admin" sketches `GET /admin/audit-logs`. `attendance_audit_log` and
// `payment_audit_log` (docs/03) are the only audit trails this codebase actually writes to —
// `src/modules/admin/README.md` named a unified `audit_logs` table as "never actually built
// beyond seeding its own `audit_log.read` permission." That permission is real; these two
// tables are what it should have always been reading. Unified into one time-sorted feed rather
// than shipping two separate screens for what is, from an admin's perspective, one concept:
// "what changed, who changed it, when."
@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(AttendanceAuditLog)
    private readonly attendanceAuditRepo: Repository<AttendanceAuditLog>,
    @InjectRepository(PaymentAuditLog)
    private readonly paymentAuditRepo: Repository<PaymentAuditLog>,
  ) {}

  async listAuditLog(
    requester: AuthenticatedUser,
    options: {
      source?: 'attendance' | 'payment';
      cursor?: string;
      limit: number;
    },
  ): Promise<AuditLogPage> {
    // `audit_log.read` is granted to both institute_admin and super_admin (the same
    // shared-permission/scoped-in-the-service pattern `user.administer` already uses —
    // AdminUsersService's own precedent): super_admin sees every institute's history,
    // institute_admin only their own. The Admin Web Panel screen this backs
    // (admin_panel_shell_screen.dart) is super_admin-only today — no nav destination reaches
    // this for institute_admin yet — but the API itself is callable by anyone holding the
    // permission, so it's scoped correctly regardless of which client ever calls it.
    const instituteId =
      requester.activeRole === 'institute_admin'
        ? (requester.instituteId ?? undefined)
        : undefined;
    if (requester.activeRole === 'institute_admin' && !instituteId) {
      return { entries: [], nextCursor: null };
    }

    const before = options.cursor ? new Date(options.cursor) : undefined;
    const [attendanceEntries, paymentEntries] = await Promise.all([
      options.source === 'payment'
        ? Promise.resolve([])
        : this.queryAttendanceAudit(instituteId, before, options.limit),
      options.source === 'attendance'
        ? Promise.resolve([])
        : this.queryPaymentAudit(instituteId, before, options.limit),
    ]);

    const merged = [...attendanceEntries, ...paymentEntries].sort(
      (a, b) => b.changedAt.getTime() - a.changedAt.getTime(),
    );
    const page = merged.slice(0, options.limit);
    // A real union-pagination limitation, named rather than silently approximated: each source
    // is paginated independently by the same `changedAt < cursor` cutoff, then merged and
    // truncated to `limit` — if one source has far more entries than the other in a given
    // window, a later page could under-fetch from the smaller one. Acceptable for an admin audit
    // viewer (nothing here drives a financial total); a real merge-cursor across two sources
    // isn't built this pass.
    const exhausted =
      attendanceEntries.length < options.limit &&
      paymentEntries.length < options.limit;
    const nextCursor = exhausted
      ? null
      : (page.at(-1)?.changedAt.toISOString() ?? null);

    return { entries: page, nextCursor };
  }

  private async queryAttendanceAudit(
    instituteId: string | undefined,
    before: Date | undefined,
    limit: number,
  ): Promise<AuditLogEntry[]> {
    const qb = this.attendanceAuditRepo
      .createQueryBuilder('log')
      .leftJoinAndSelect('log.changedBy', 'changedBy')
      .leftJoin('log.attendanceRecord', 'record')
      .leftJoin('record.attendanceSession', 'session')
      .leftJoin('session.class', 'class')
      .orderBy('log.changedAt', 'DESC')
      .take(limit);
    if (instituteId)
      qb.andWhere('class.institute_id = :instituteId', { instituteId });
    if (before) qb.andWhere('log.changedAt < :before', { before });

    const rows = await qb.getMany();
    return rows.map((row) => ({
      id: row.id,
      source: 'attendance' as const,
      previousStatus: row.previousStatus,
      newStatus: row.newStatus,
      changedByName: row.changedBy?.fullName ?? null,
      changedAt: row.changedAt,
      note: row.reason ?? null,
    }));
  }

  private async queryPaymentAudit(
    instituteId: string | undefined,
    before: Date | undefined,
    limit: number,
  ): Promise<AuditLogEntry[]> {
    const qb = this.paymentAuditRepo
      .createQueryBuilder('log')
      .leftJoinAndSelect('log.changedBy', 'changedBy')
      .leftJoin('log.payment', 'payment')
      .leftJoin('payment.invoice', 'invoice')
      .orderBy('log.changedAt', 'DESC')
      .take(limit);
    if (instituteId)
      qb.andWhere('invoice.institute_id = :instituteId', { instituteId });
    if (before) qb.andWhere('log.changedAt < :before', { before });

    const rows = await qb.getMany();
    return rows.map((row) => ({
      id: row.id,
      source: 'payment' as const,
      previousStatus: row.previousStatus,
      newStatus: row.newStatus,
      changedByName: row.changedBy?.fullName ?? null,
      changedAt: row.changedAt,
      note: row.note ?? null,
    }));
  }
}
