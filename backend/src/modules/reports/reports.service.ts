import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, In, Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import {
  AttendanceSession,
  AttendanceSessionStatus,
} from '../attendance/entities/attendance-session.entity';
import {
  AttendanceRecord,
  AttendanceStatus,
} from '../attendance/entities/attendance-record.entity';
import { Class } from '../classes/entities/class.entity';
import { Invoice } from '../fees/entities/invoice.entity';
import { Payment, PaymentStatus } from '../fees/entities/payment.entity';
import { CreditNote } from '../fees/entities/credit-note.entity';
import { StudentProfile } from '../students/entities/student-profile.entity';
import { PerformanceRecord } from '../performance/entities/performance-record.entity';
import {
  ExportJob,
  ExportJobStatus,
  ReportFormat,
  ReportType,
} from './entities/export-job.entity';
import { User } from '../users/entities/user.entity';
import { TeacherProfilesService } from '../teacher-profiles/teacher-profiles.service';
import { AuthenticatedUser } from '../../common/interfaces/request-with-user.interface';
import { ReportQueryDto } from './dto/report-query.dto';
import { CreateExportJobDto } from './dto/create-export-job.dto';
import { toCsv } from './utils/csv.util';
import { renderPdfTable, renderPdfProfile } from './utils/pdf.util';
import {
  STORAGE_ADAPTER,
  StorageAdapter,
} from '../../common/storage/storage.adapter';

export interface GeneratedFile {
  filename: string;
  contentType: string;
  buffer: Buffer;
}

export interface ExportJobSummary {
  id: string;
  reportType: ReportType;
  format: ReportFormat;
  status: ExportJobStatus;
  errorMessage: string | null;
  createdAt: Date;
  completedAt: Date | null;
}

// docs/06 §6.2 "Reports/analytics | F (own scope) | – | – | F (institute scope) | F (platform
// scope)" — one `report.generate` permission for the three roles that hold it at all; the actual
// scope (own classes/students for a teacher, own institute for institute_admin, any institute or
// platform-wide for super_admin) is resource-level, resolved here rather than by a client-
// supplied scope id — see report-query.dto.ts's header comment. Each module this pulls read-only
// data from (Attendance, Fees, Performance) is injected directly by entity, never by importing
// that module's service, matching this codebase's "each module owns its own access resolution
// and duplicates the small helper it needs" convention (see e.g. FeesService.hasStudentFinanceAccess's
// duplicates in Performance/Notes).
@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(AttendanceSession)
    private readonly sessionRepo: Repository<AttendanceSession>,
    @InjectRepository(AttendanceRecord)
    private readonly recordRepo: Repository<AttendanceRecord>,
    @InjectRepository(Class) private readonly classRepo: Repository<Class>,
    @InjectRepository(Invoice)
    private readonly invoiceRepo: Repository<Invoice>,
    @InjectRepository(Payment)
    private readonly paymentRepo: Repository<Payment>,
    @InjectRepository(CreditNote)
    private readonly creditNoteRepo: Repository<CreditNote>,
    @InjectRepository(StudentProfile)
    private readonly studentRepo: Repository<StudentProfile>,
    @InjectRepository(PerformanceRecord)
    private readonly performanceRepo: Repository<PerformanceRecord>,
    @InjectRepository(ExportJob)
    private readonly exportJobRepo: Repository<ExportJob>,
    private readonly teacherProfilesService: TeacherProfilesService,
    @Inject(STORAGE_ADAPTER) private readonly storage: StorageAdapter,
  ) {}

  // ---------------------------------------------------------------- Direct (synchronous) -------

  async generateAttendanceReport(
    requester: AuthenticatedUser,
    dto: ReportQueryDto,
  ): Promise<GeneratedFile> {
    const classIds = await this.resolveClassScope(requester, dto.instituteId);
    const rows: Array<{
      className: string;
      sessionsHeld: number;
      present: number;
      absent: number;
      late: number;
      excused: number;
      percentage: string;
    }> = [];

    if (classIds.length > 0) {
      const sessions = await this.sessionRepo.find({
        where: {
          class: { id: In(classIds) },
          occurrenceDate: Between(dto.from, dto.to),
          status: AttendanceSessionStatus.HELD,
        },
        relations: { class: true },
      });
      const byClass = new Map<
        string,
        { className: string; sessionIds: string[] }
      >();
      for (const session of sessions) {
        const entry = byClass.get(session.class.id) ?? {
          className: session.class.name,
          sessionIds: [],
        };
        entry.sessionIds.push(session.id);
        byClass.set(session.class.id, entry);
      }

      for (const { className, sessionIds } of byClass.values()) {
        const records = sessionIds.length
          ? await this.recordRepo.find({
              where: { attendanceSession: { id: In(sessionIds) } },
            })
          : [];
        const applicable = records.filter(
          (r) =>
            r.status !== AttendanceStatus.HOLIDAY &&
            r.status !== AttendanceStatus.CANCELLED,
        );
        const present = applicable.filter(
          (r) => r.status === AttendanceStatus.PRESENT,
        ).length;
        const late = applicable.filter(
          (r) => r.status === AttendanceStatus.LATE,
        ).length;
        const absent = applicable.filter(
          (r) => r.status === AttendanceStatus.ABSENT,
        ).length;
        const excused = applicable.filter(
          (r) => r.status === AttendanceStatus.EXCUSED,
        ).length;
        const percentage = applicable.length
          ? ((present + late) / applicable.length) * 100
          : 0;
        rows.push({
          className,
          sessionsHeld: sessionIds.length,
          present,
          absent,
          late,
          excused,
          percentage: percentage.toFixed(1) + '%',
        });
      }
    }

    return this.renderAttendance(rows, dto.format);
  }

  async generateFeesReport(
    requester: AuthenticatedUser,
    dto: ReportQueryDto,
  ): Promise<GeneratedFile> {
    const scopeWhere = await this.resolveInvoiceScope(
      requester,
      dto.instituteId,
    );
    const invoices = scopeWhere
      ? await this.invoiceRepo.find({
          where: {
            ...scopeWhere,
            issuedAt: Between(new Date(dto.from), new Date(dto.to)),
          },
          relations: { student: true },
          order: { issuedAt: 'ASC' },
        })
      : [];

    const rows: Array<{
      studentName: string;
      billingPeriodStart: string;
      billingPeriodEnd: string;
      totalAmount: number;
      paidTotal: number;
      status: string;
      dueDate: string;
    }> = [];
    let totalBilled = 0;
    let totalPaid = 0;

    for (const invoice of invoices) {
      const { netTotal, paidTotal } = await this.getInvoiceFinancials(invoice);
      totalBilled += netTotal;
      totalPaid += paidTotal;
      rows.push({
        studentName: invoice.student.fullName,
        billingPeriodStart: invoice.billingPeriodStart,
        billingPeriodEnd: invoice.billingPeriodEnd,
        totalAmount: netTotal,
        paidTotal,
        status: invoice.status,
        dueDate: invoice.dueDate,
      });
    }

    return this.renderFees(rows, totalBilled, totalPaid, dto.format);
  }

  async generateStudentReport(
    studentId: string,
    requester: AuthenticatedUser,
  ): Promise<GeneratedFile> {
    const student = await this.studentRepo.findOne({
      where: { id: studentId },
    });
    if (!student) {
      throw new NotFoundException({
        code: 'STUDENT_NOT_FOUND',
        message: `Student ${studentId} not found`,
      });
    }
    // Reuses the same "own scope" rule as the aggregate reports — a teacher may only ever pull a
    // report for a student they actually teach, resolved via the assignment table exactly the
    // way FeesService/PerformanceService already do for their own read paths (duplicated per this
    // codebase's convention, not shared).
    await this.assertStudentReportAccess(student, requester);

    const records = await this.recordRepo.find({
      where: { student: { id: studentId } },
    });
    const applicable = records.filter(
      (r) =>
        r.status !== AttendanceStatus.HOLIDAY &&
        r.status !== AttendanceStatus.CANCELLED,
    );
    const present = applicable.filter(
      (r) =>
        r.status === AttendanceStatus.PRESENT ||
        r.status === AttendanceStatus.LATE,
    ).length;
    const attendancePercentage = applicable.length
      ? ((present / applicable.length) * 100).toFixed(1) + '%'
      : '—';

    const invoices = await this.invoiceRepo.find({
      where: { student: { id: studentId } },
    });
    let outstanding = 0;
    for (const invoice of invoices) {
      const { netTotal, paidTotal } = await this.getInvoiceFinancials(invoice);
      outstanding += Math.max(netTotal - paidTotal, 0);
    }

    const performance = await this.performanceRepo.find({
      where: { student: { id: studentId } },
      relations: { metricDefinition: true },
      order: { recordedAt: 'DESC' },
      take: 10,
    });

    const buffer = await renderPdfProfile(
      `Student Report — ${student.fullName}`,
      new Date(),
      [
        {
          heading: 'Profile',
          lines: [
            { label: 'Full name', value: student.fullName },
            { label: 'Join date', value: student.joinDate },
            { label: 'Enrollment status', value: student.enrollmentStatus },
          ],
        },
        {
          heading: 'Attendance',
          lines: [
            { label: 'All-time attendance', value: attendancePercentage },
          ],
        },
        {
          heading: 'Fees',
          lines: [
            { label: 'Outstanding balance', value: outstanding.toFixed(2) },
          ],
        },
        {
          heading: 'Recent performance',
          lines: performance.length
            ? performance.map((p) => ({
                label: p.metricDefinition.name,
                value: `${p.value} (${p.recordedAt.toISOString().slice(0, 10)})`,
              }))
            : [{ label: 'No records yet', value: '' }],
        },
      ],
    );

    return {
      filename: `student-report-${studentId}.pdf`,
      contentType: 'application/pdf',
      buffer,
    };
  }

  // ---------------------------------------------------------------- Async export jobs -----------

  // docs/04 §4.7 "Large exports run as an async job... actual work happens on a BullMQ worker."
  // No BullMQ/Redis is wired up anywhere in this codebase (same documented gap as Notifications'
  // digest batching) — the job row is created and returned immediately (the 202-and-poll
  // contract this doc actually cares about), and the real work runs via a fire-and-forget async
  // call right after, in this same process. Genuinely non-blocking and pollable/retryable
  // without pretending to a queue infrastructure this MVP doesn't have.
  async createExportJob(
    requester: AuthenticatedUser,
    dto: CreateExportJobDto,
  ): Promise<ExportJobSummary> {
    const job = await this.exportJobRepo.save(
      this.exportJobRepo.create({
        requestedBy: { id: requester.userId } as User,
        reportType: dto.reportType,
        format: dto.format,
        fromDate: dto.from,
        toDate: dto.to,
        instituteId: dto.instituteId ?? null,
        status: ExportJobStatus.PENDING,
      }),
    );

    void this.processExportJob(job.id, requester);

    return this.toJobSummary(job);
  }

  async getExportJob(
    id: string,
    requester: AuthenticatedUser,
  ): Promise<ExportJobSummary> {
    const job = await this.getJobOrThrow(id, requester);
    return this.toJobSummary(job);
  }

  async getExportJobFile(
    id: string,
    requester: AuthenticatedUser,
  ): Promise<GeneratedFile> {
    const job = await this.getJobOrThrow(id, requester);
    if (job.status !== ExportJobStatus.COMPLETED || !job.objectKey) {
      throw new BadRequestException({
        code: 'EXPORT_JOB_NOT_READY',
        message: `This export job is ${job.status}, not completed`,
      });
    }
    const buffer = await this.storage.readObject(job.objectKey);
    return {
      filename: `${job.reportType}-report.${job.format}`,
      contentType:
        job.format === ReportFormat.PDF ? 'application/pdf' : 'text/csv',
      buffer,
    };
  }

  private async processExportJob(
    jobId: string,
    requester: AuthenticatedUser,
  ): Promise<void> {
    const job = await this.exportJobRepo.findOne({ where: { id: jobId } });
    if (!job) return;
    job.status = ExportJobStatus.PROCESSING;
    await this.exportJobRepo.save(job);

    try {
      const query: ReportQueryDto = {
        from: job.fromDate,
        to: job.toDate,
        format: job.format,
        instituteId: job.instituteId ?? undefined,
      };
      const file =
        job.reportType === ReportType.ATTENDANCE
          ? await this.generateAttendanceReport(requester, query)
          : await this.generateFeesReport(requester, query);

      const objectKey = randomUUID();
      await this.storage.writeObject(objectKey, file.buffer);

      job.status = ExportJobStatus.COMPLETED;
      job.objectKey = objectKey;
      job.completedAt = new Date();
      await this.exportJobRepo.save(job);
    } catch (err) {
      job.status = ExportJobStatus.FAILED;
      job.errorMessage = err instanceof Error ? err.message : 'Unknown error';
      await this.exportJobRepo.save(job);
    }
  }

  private async getJobOrThrow(
    id: string,
    requester: AuthenticatedUser,
  ): Promise<ExportJob> {
    const job = await this.exportJobRepo.findOne({
      where: { id },
      relations: { requestedBy: true },
    });
    if (!job) {
      throw new NotFoundException({
        code: 'EXPORT_JOB_NOT_FOUND',
        message: `Export job ${id} not found`,
      });
    }
    if (
      job.requestedBy.id !== requester.userId &&
      requester.activeRole !== 'super_admin'
    ) {
      throw new ForbiddenException({
        code: 'NOT_AUTHORIZED_FOR_EXPORT_JOB',
        message: 'You can only view your own export jobs',
      });
    }
    return job;
  }

  private toJobSummary(job: ExportJob): ExportJobSummary {
    return {
      id: job.id,
      reportType: job.reportType,
      format: job.format,
      status: job.status,
      errorMessage: job.errorMessage ?? null,
      createdAt: job.createdAt,
      completedAt: job.completedAt ?? null,
    };
  }

  // ---------------------------------------------------------------- Scope resolution -----------

  // Returns the class ids in scope for this requester — a teacher's own classes, an
  // institute_admin's institute's classes, or (super_admin) either one institute's classes or
  // every class on the platform.
  private async resolveClassScope(
    requester: AuthenticatedUser,
    instituteId?: string,
  ): Promise<string[]> {
    if (requester.activeRole === 'teacher') {
      const teacherProfile = await this.teacherProfilesService.findByUserId(
        requester.userId,
      );
      if (!teacherProfile) return [];
      const classes = await this.classRepo.find({
        where: { teacherProfile: { id: teacherProfile.id } },
      });
      return classes.map((c) => c.id);
    }
    if (requester.activeRole === 'institute_admin') {
      if (!requester.instituteId) return [];
      const classes = await this.classRepo.find({
        where: { institute: { id: requester.instituteId } },
      });
      return classes.map((c) => c.id);
    }
    // super_admin
    const classes = await this.classRepo.find({
      where: instituteId ? { institute: { id: instituteId } } : {},
    });
    return classes.map((c) => c.id);
  }

  // Mirrors resolveClassScope but as a TypeORM `where` fragment for Invoice, whose scope columns
  // (teacherProfile/institute) differ from Class's — returns `null` when a teacher has no profile
  // yet (an empty scope) rather than an empty `where` (which would wrongly match every invoice).
  private async resolveInvoiceScope(
    requester: AuthenticatedUser,
    instituteId?: string,
  ): Promise<Record<string, unknown> | null> {
    if (requester.activeRole === 'teacher') {
      const teacherProfile = await this.teacherProfilesService.findByUserId(
        requester.userId,
      );
      if (!teacherProfile) return null;
      return { teacherProfile: { id: teacherProfile.id } };
    }
    if (requester.activeRole === 'institute_admin') {
      if (!requester.instituteId) return null;
      return { institute: { id: requester.instituteId } };
    }
    // super_admin
    return instituteId ? { institute: { id: instituteId } } : {};
  }

  private async assertStudentReportAccess(
    student: StudentProfile,
    requester: AuthenticatedUser,
  ): Promise<void> {
    if (requester.activeRole === 'super_admin') return;
    if (requester.activeRole === 'institute_admin') {
      const full = await this.studentRepo.findOne({
        where: { id: student.id },
        relations: { institute: true },
      });
      if (full?.institute?.id && full.institute.id === requester.instituteId)
        return;
      throw new ForbiddenException({
        code: 'NOT_AUTHORIZED_FOR_STUDENT_REPORT',
        message: 'You do not have permission to report on this student',
      });
    }
    if (requester.activeRole === 'teacher') {
      const teacherProfile = await this.teacherProfilesService.findByUserId(
        requester.userId,
      );
      const classesTaught = teacherProfile
        ? await this.classRepo.find({
            where: { teacherProfile: { id: teacherProfile.id } },
          })
        : [];
      const invoicesForStudent = teacherProfile
        ? await this.invoiceRepo.find({
            where: {
              student: { id: student.id },
              teacherProfile: { id: teacherProfile.id },
            },
          })
        : [];
      // "Do I teach this student" is answered the same way FeesService does — via an existing
      // invoice/fee relationship, or an active enrollment in one of my classes — rather than
      // re-deriving it a third way.
      if (invoicesForStudent.length > 0 || classesTaught.length > 0) {
        const hasAttendanceLink = await this.recordRepo.findOne({
          where: {
            student: { id: student.id },
            attendanceSession: {
              class: { teacherProfile: { id: teacherProfile?.id } },
            },
          },
          relations: { attendanceSession: { class: true } },
        });
        if (invoicesForStudent.length > 0 || hasAttendanceLink) return;
      }
    }
    throw new ForbiddenException({
      code: 'NOT_AUTHORIZED_FOR_STUDENT_REPORT',
      message: 'You do not have permission to report on this student',
    });
  }

  private async getInvoiceFinancials(
    invoice: Invoice,
  ): Promise<{ netTotal: number; paidTotal: number }> {
    const [creditNotes, payments] = await Promise.all([
      this.creditNoteRepo.find({ where: { invoice: { id: invoice.id } } }),
      this.paymentRepo.find({ where: { invoice: { id: invoice.id } } }),
    ]);
    const netTotal = Math.max(
      Number(invoice.totalAmount) -
        creditNotes.reduce((sum, c) => sum + Number(c.amount), 0),
      0,
    );
    const paidTotal = payments
      .filter((p) => p.status === PaymentStatus.CONFIRMED)
      .reduce((sum, p) => sum + Number(p.amount), 0);
    return { netTotal, paidTotal };
  }

  // ---------------------------------------------------------------- Rendering -------------------

  private async renderAttendance(
    rows: Array<{
      className: string;
      sessionsHeld: number;
      present: number;
      absent: number;
      late: number;
      excused: number;
      percentage: string;
    }>,
    format: ReportFormat,
  ): Promise<GeneratedFile> {
    if (format === ReportFormat.CSV) {
      const buffer = toCsv(
        [
          'Class',
          'Sessions held',
          'Present',
          'Absent',
          'Late',
          'Excused',
          'Attendance %',
        ],
        rows.map((r) => [
          r.className,
          r.sessionsHeld,
          r.present,
          r.absent,
          r.late,
          r.excused,
          r.percentage,
        ]),
      );
      return {
        filename: 'attendance-report.csv',
        contentType: 'text/csv',
        buffer,
      };
    }
    const buffer = await renderPdfTable({
      title: 'Attendance Report',
      generatedAt: new Date(),
      columns: [
        { header: 'Class', width: 160 },
        { header: 'Sessions', width: 60 },
        { header: 'Present', width: 60 },
        { header: 'Absent', width: 60 },
        { header: 'Late', width: 50 },
        { header: 'Excused', width: 60 },
        { header: 'Attendance %', width: 70 },
      ],
      rows: rows.map((r) => [
        r.className,
        r.sessionsHeld,
        r.present,
        r.absent,
        r.late,
        r.excused,
        r.percentage,
      ]),
    });
    return {
      filename: 'attendance-report.pdf',
      contentType: 'application/pdf',
      buffer,
    };
  }

  private async renderFees(
    rows: Array<{
      studentName: string;
      billingPeriodStart: string;
      billingPeriodEnd: string;
      totalAmount: number;
      paidTotal: number;
      status: string;
      dueDate: string;
    }>,
    totalBilled: number,
    totalPaid: number,
    format: ReportFormat,
  ): Promise<GeneratedFile> {
    if (format === ReportFormat.CSV) {
      const buffer = toCsv(
        [
          'Student',
          'Period start',
          'Period end',
          'Amount',
          'Paid',
          'Status',
          'Due date',
        ],
        rows.map((r) => [
          r.studentName,
          r.billingPeriodStart,
          r.billingPeriodEnd,
          r.totalAmount.toFixed(2),
          r.paidTotal.toFixed(2),
          r.status,
          r.dueDate,
        ]),
      );
      return { filename: 'fees-report.csv', contentType: 'text/csv', buffer };
    }
    const buffer = await renderPdfTable({
      title: 'Fees Report',
      generatedAt: new Date(),
      columns: [
        { header: 'Student', width: 130 },
        { header: 'Period start', width: 80 },
        { header: 'Period end', width: 80 },
        { header: 'Amount', width: 70 },
        { header: 'Paid', width: 70 },
        { header: 'Status', width: 60 },
        { header: 'Due date', width: 70 },
      ],
      rows: rows.map((r) => [
        r.studentName,
        r.billingPeriodStart,
        r.billingPeriodEnd,
        r.totalAmount.toFixed(2),
        r.paidTotal.toFixed(2),
        r.status,
        r.dueDate,
      ]),
      footerLines: [
        `Total billed: ${totalBilled.toFixed(2)}`,
        `Total collected: ${totalPaid.toFixed(2)}`,
      ],
    });
    return {
      filename: 'fees-report.pdf',
      contentType: 'application/pdf',
      buffer,
    };
  }
}
