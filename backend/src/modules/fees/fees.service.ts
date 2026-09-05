import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, In, LessThanOrEqual, Repository } from 'typeorm';
import { FeeStructure } from './entities/fee-structure.entity';
import { Discount, DiscountType } from './entities/discount.entity';
import { Invoice, InvoiceStatus } from './entities/invoice.entity';
import { InvoiceLineItem } from './entities/invoice-line-item.entity';
import { CreditNote } from './entities/credit-note.entity';
import {
  Payment,
  PaymentMethod,
  PaymentStatus,
  ConfirmedVia,
} from './entities/payment.entity';
import { PaymentAuditLog } from './entities/payment-audit-log.entity';
import { Refund, RefundStatus } from './entities/refund.entity';
import { StudentCreditLedgerEntry } from './entities/student-credit-ledger-entry.entity';
import { Class } from '../classes/entities/class.entity';
import { Institute } from '../institutes/entities/institute.entity';
import {
  Enrollment,
  EnrollmentEntryStatus,
} from '../classes/entities/enrollment.entity';
import { StudentProfile } from '../students/entities/student-profile.entity';
import { StudentGuardianLink } from '../students/entities/student-guardian-link.entity';
import { StudentTeacherAssignment } from '../students/entities/student-teacher-assignment.entity';
import {
  AttendanceSession,
  AttendanceSessionStatus,
} from '../attendance/entities/attendance-session.entity';
import {
  AttendanceRecord,
  AttendanceStatus,
} from '../attendance/entities/attendance-record.entity';
import { User } from '../users/entities/user.entity';
import { TeacherProfilesService } from '../teacher-profiles/teacher-profiles.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AuthenticatedUser } from '../../common/interfaces/request-with-user.interface';
import { CreateFeeStructureDto } from './dto/create-fee-structure.dto';
import { CreateDiscountDto } from './dto/create-discount.dto';
import { GenerateInvoicesDto } from './dto/generate-invoices.dto';
import { CreateCreditNoteDto } from './dto/create-credit-note.dto';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { InitiateGatewayPaymentDto } from './dto/initiate-gateway-payment.dto';
import { CreateRefundDto } from './dto/create-refund.dto';
import {
  PAYMENT_GATEWAY_ADAPTER,
  PaymentGatewayAdapter,
} from './gateway/payment-gateway.adapter';

export interface InvoiceSummary {
  id: string;
  billingPeriodStart: string;
  billingPeriodEnd: string;
  subtotal: number;
  discountTotal: number;
  lateFeeTotal: number;
  creditNoteTotal: number;
  totalAmount: number; // after credit notes
  paidTotal: number;
  currency: string;
  status: InvoiceStatus;
  dueDate: string;
  issuedAt: Date;
}

export interface RevenueSummary {
  instituteId: string;
  totalCollected: number;
  totalPending: number;
  totalOverdue: number;
  currency: string;
}

const round2 = (value: number): number => Math.round(value * 100) / 100;

@Injectable()
export class FeesService {
  constructor(
    @InjectRepository(FeeStructure)
    private readonly feeStructureRepo: Repository<FeeStructure>,
    @InjectRepository(Discount)
    private readonly discountRepo: Repository<Discount>,
    @InjectRepository(Invoice)
    private readonly invoiceRepo: Repository<Invoice>,
    @InjectRepository(InvoiceLineItem)
    private readonly lineItemRepo: Repository<InvoiceLineItem>,
    @InjectRepository(CreditNote)
    private readonly creditNoteRepo: Repository<CreditNote>,
    @InjectRepository(Payment)
    private readonly paymentRepo: Repository<Payment>,
    @InjectRepository(PaymentAuditLog)
    private readonly paymentAuditRepo: Repository<PaymentAuditLog>,
    @InjectRepository(Refund) private readonly refundRepo: Repository<Refund>,
    @InjectRepository(StudentCreditLedgerEntry)
    private readonly creditLedgerRepo: Repository<StudentCreditLedgerEntry>,
    @InjectRepository(Class) private readonly classRepo: Repository<Class>,
    @InjectRepository(Institute)
    private readonly instituteRepo: Repository<Institute>,
    @InjectRepository(Enrollment)
    private readonly enrollmentRepo: Repository<Enrollment>,
    @InjectRepository(StudentProfile)
    private readonly studentRepo: Repository<StudentProfile>,
    @InjectRepository(StudentGuardianLink)
    private readonly guardianLinkRepo: Repository<StudentGuardianLink>,
    @InjectRepository(StudentTeacherAssignment)
    private readonly assignmentRepo: Repository<StudentTeacherAssignment>,
    @InjectRepository(AttendanceSession)
    private readonly attendanceSessionRepo: Repository<AttendanceSession>,
    @InjectRepository(AttendanceRecord)
    private readonly attendanceRecordRepo: Repository<AttendanceRecord>,
    private readonly teacherProfilesService: TeacherProfilesService,
    private readonly notificationsService: NotificationsService,
    @Inject(PAYMENT_GATEWAY_ADAPTER)
    private readonly gateway: PaymentGatewayAdapter,
  ) {}

  // ---------------------------------------------------------------- Fee structures ----------

  async createFeeStructure(
    requester: AuthenticatedUser,
    dto: CreateFeeStructureDto,
  ): Promise<FeeStructure> {
    const cls = await this.getClassOrThrow(dto.classId);
    await this.assertClassWriteAccess(cls, requester);

    const feeStructure = this.feeStructureRepo.create({
      institute: cls.institute ?? null,
      teacherProfile: cls.teacherProfile,
      class: cls,
      billingModel: dto.billingModel,
      amount: dto.amount.toFixed(2),
      currency: dto.currency ?? 'INR',
      prorationPolicy: dto.prorationPolicy,
      lateFeeRule: dto.lateFeeRule,
    });
    return this.feeStructureRepo.save(feeStructure);
  }

  async listFeeStructures(
    classId: string,
    requester: AuthenticatedUser,
  ): Promise<FeeStructure[]> {
    const cls = await this.getClassOrThrow(classId);
    await this.assertClassWriteAccess(cls, requester);
    return this.feeStructureRepo.find({
      where: { class: { id: classId } },
      order: { createdAt: 'DESC' },
    });
  }

  async createDiscount(
    requester: AuthenticatedUser,
    dto: CreateDiscountDto,
  ): Promise<Discount> {
    if (!dto.studentId && !dto.classId) {
      throw new BadRequestException({
        code: 'STUDENT_OR_CLASS_REQUIRED',
        message: 'Provide at least a studentId or a classId',
      });
    }

    let cls: Class | null = null;
    if (dto.classId) {
      cls = await this.getClassOrThrow(dto.classId);
      await this.assertClassWriteAccess(cls, requester);
    }
    let student: StudentProfile | null = null;
    if (dto.studentId) {
      student = await this.studentRepo.findOne({
        where: { id: dto.studentId },
      });
      if (!student) {
        throw new NotFoundException({
          code: 'STUDENT_NOT_FOUND',
          message: `Student ${dto.studentId} not found`,
        });
      }
      // A student-only discount (no classId) still needs a scoping check — reuse the same
      // finance-access rule as viewing invoices, since granting a discount is finance-adjacent.
      if (!cls) {
        const fullStudent = await this.studentRepo.findOne({
          where: { id: dto.studentId },
          relations: { user: true, institute: true },
          select: { id: true, user: { id: true }, institute: { id: true } },
        });
        if (
          !fullStudent ||
          !(await this.hasStudentFinanceAccess(fullStudent, requester))
        ) {
          throw new ForbiddenException({
            code: 'NOT_AUTHORIZED_FOR_FEES',
            message:
              'You do not have permission to grant a discount to this student',
          });
        }
      }
    }

    const discount = this.discountRepo.create({
      student,
      class: cls,
      type: dto.type,
      value: dto.value.toFixed(2),
      reason: dto.reason,
      approvedBy: { id: requester.userId } as User,
    });
    return this.discountRepo.save(discount);
  }

  // ---------------------------------------------------------------- Invoice generation -------

  // docs/04 §4.4 POST /invoices/generate. docs/01 §1.5 "attendance vs fee coupling is a policy" —
  // `per_class_deduction` is the only proration policy this computes; anything else charges the
  // flat fee-structure amount untouched.
  async generateInvoices(
    requester: AuthenticatedUser,
    dto: GenerateInvoicesDto,
  ): Promise<InvoiceSummary[]> {
    const cls = await this.getClassOrThrow(dto.classId);
    await this.assertClassWriteAccess(cls, requester);

    const feeStructure = await this.feeStructureRepo.findOne({
      where: { class: { id: dto.classId } },
      order: { createdAt: 'DESC' },
    });
    if (!feeStructure) {
      throw new BadRequestException({
        code: 'NO_FEE_STRUCTURE',
        message:
          'This class has no fee structure — create one before generating invoices',
      });
    }

    const enrollments = await this.enrollmentRepo.find({
      where: {
        class: { id: dto.classId },
        enrolledFrom: LessThanOrEqual(dto.billingPeriodEnd),
        status: In([EnrollmentEntryStatus.ACTIVE, EnrollmentEntryStatus.TRIAL]),
      },
      relations: { student: true },
    });
    const activeEnrollments = enrollments.filter(
      (e) => !e.enrolledTo || e.enrolledTo >= dto.billingPeriodStart,
    );

    const summaries: InvoiceSummary[] = [];
    for (const enrollment of activeEnrollments) {
      const existing = await this.invoiceRepo.findOne({
        where: {
          student: { id: enrollment.student.id },
          teacherProfile: { id: cls.teacherProfile.id },
          billingPeriodStart: dto.billingPeriodStart,
          billingPeriodEnd: dto.billingPeriodEnd,
        },
      });
      if (existing) continue; // idempotent re-generation — never double-bill the same period

      const invoice = await this.generateOneInvoice(
        cls,
        feeStructure,
        enrollment.student,
        dto,
      );
      summaries.push(await this.toInvoiceSummary(invoice));
    }
    return summaries;
  }

  private async generateOneInvoice(
    cls: Class,
    feeStructure: FeeStructure,
    student: StudentProfile,
    dto: GenerateInvoicesDto,
  ): Promise<Invoice> {
    const subtotal = Number(feeStructure.amount);
    let runningTotal = subtotal;
    const lineItems: Array<{ description: string; amount: string }> = [
      {
        description: `${cls.name} fee (${dto.billingPeriodStart} – ${dto.billingPeriodEnd})`,
        amount: feeStructure.amount,
      },
    ];

    // --- Attendance-based proration --------------------------------------------------------
    if (feeStructure.prorationPolicy === 'per_class_deduction') {
      const heldSessions = await this.attendanceSessionRepo.find({
        where: {
          class: { id: cls.id },
          status: AttendanceSessionStatus.HELD,
          occurrenceDate: Between(dto.billingPeriodStart, dto.billingPeriodEnd),
        },
      });
      if (heldSessions.length > 0) {
        const absentCount = await this.attendanceRecordRepo.count({
          where: {
            student: { id: student.id },
            status: AttendanceStatus.ABSENT,
            attendanceSession: { id: In(heldSessions.map((s) => s.id)) },
          },
        });
        if (absentCount > 0) {
          const perClassAmount = subtotal / heldSessions.length;
          const deduction = round2(perClassAmount * absentCount);
          runningTotal -= deduction;
          lineItems.push({
            description: `Attendance-based deduction (${absentCount} absent class(es))`,
            amount: (-deduction).toFixed(2),
          });
        }
      }
    }

    // --- Discounts --------------------------------------------------------------------------
    const discounts = await this.discountRepo.find({
      where: [{ student: { id: student.id } }, { class: { id: cls.id } }],
    });
    let discountTotal = 0;
    for (const discount of discounts) {
      const amount =
        discount.type === DiscountType.PERCENT
          ? round2((runningTotal * Number(discount.value)) / 100)
          : Number(discount.value);
      discountTotal += amount;
      runningTotal -= amount;
      lineItems.push({
        description: `Discount${discount.reason ? `: ${discount.reason}` : ''}`,
        amount: (-amount).toFixed(2),
      });
    }
    runningTotal = Math.max(runningTotal, 0);

    // --- Consume available credit balance (docs/01 §1.5 overpayment → credit) ---------------
    const availableCredit = await this.getAvailableCredit(student.id);
    const creditApplied = Math.min(availableCredit, runningTotal);

    const invoice = this.invoiceRepo.create({
      student,
      institute: cls.institute ?? null,
      teacherProfile: cls.teacherProfile,
      billingPeriodStart: dto.billingPeriodStart,
      billingPeriodEnd: dto.billingPeriodEnd,
      subtotal: subtotal.toFixed(2),
      discountTotal: discountTotal.toFixed(2),
      lateFeeTotal: '0.00',
      taxTotal: '0.00',
      totalAmount: (runningTotal - creditApplied).toFixed(2),
      currency: feeStructure.currency,
      dueDate: dto.dueDate,
    });
    const saved = await this.invoiceRepo.save(invoice);

    for (const item of lineItems) {
      await this.lineItemRepo.save(
        this.lineItemRepo.create({
          invoice: saved,
          description: item.description,
          amount: item.amount,
        }),
      );
    }
    if (creditApplied > 0) {
      await this.lineItemRepo.save(
        this.lineItemRepo.create({
          invoice: saved,
          description: 'Credit balance applied',
          amount: (-creditApplied).toFixed(2),
        }),
      );
      await this.creditLedgerRepo.save(
        this.creditLedgerRepo.create({
          student,
          amount: (-creditApplied).toFixed(2),
          sourceInvoice: saved,
          note: 'Applied to invoice at generation',
        }),
      );
    }

    // docs/01 §1.3 notification digesting example — "a new invoice" is informational, not
    // critical, so this defaults to a daily digest rather than an immediate push (see
    // notifications.constants.ts's DEFAULT_CHANNEL_BY_CATEGORY).
    await this.notifyStudentParty(
      student.id,
      'invoice_issued',
      'New invoice issued',
      `${cls.name}: ${feeStructure.currency} ${Number(saved.totalAmount).toFixed(2)} due ${dto.dueDate}`,
      { invoiceId: saved.id },
    );

    return saved;
  }

  // ---------------------------------------------------------------- Reading invoices ---------

  async getStudentInvoices(
    studentId: string,
    requester: AuthenticatedUser,
  ): Promise<InvoiceSummary[]> {
    const student = await this.studentRepo.findOne({
      where: { id: studentId },
      relations: { user: true, institute: true },
      select: { id: true, user: { id: true }, institute: { id: true } },
    });
    if (!student) {
      throw new NotFoundException({
        code: 'STUDENT_NOT_FOUND',
        message: `Student ${studentId} not found`,
      });
    }
    if (!(await this.hasStudentFinanceAccess(student, requester))) {
      throw new ForbiddenException({
        code: 'NOT_AUTHORIZED_FOR_INVOICES',
        message: "You do not have access to this student's invoices",
      });
    }

    const invoices = await this.invoiceRepo.find({
      where: { student: { id: studentId } },
      order: { issuedAt: 'DESC' },
    });
    return Promise.all(
      invoices.map((invoice) => this.toInvoiceSummary(invoice)),
    );
  }

  async createCreditNote(
    invoiceId: string,
    requester: AuthenticatedUser,
    dto: CreateCreditNoteDto,
  ): Promise<CreditNote> {
    const invoice = await this.getInvoiceOrThrow(invoiceId);
    await this.assertInvoiceWriteAccess(invoice, requester);

    const creditNote = this.creditNoteRepo.create({
      invoice,
      amount: dto.amount.toFixed(2),
      reason: dto.reason,
      issuedBy: { id: requester.userId } as User,
    });
    const saved = await this.creditNoteRepo.save(creditNote);
    await this.recomputeInvoiceStatus(invoice);
    return saved;
  }

  // ---------------------------------------------------------------- Payments -----------------

  async recordPayment(
    requester: AuthenticatedUser,
    dto: CreatePaymentDto,
  ): Promise<Payment> {
    const existing = await this.paymentRepo.findOne({
      where: { idempotencyKey: dto.idempotencyKey },
    });
    if (existing) return existing; // docs/01 §1.5 "duplicate payment" — safe retry, not a second charge

    const invoice = await this.getInvoiceOrThrow(dto.invoiceId);
    await this.assertInvoiceWriteAccess(invoice, requester);

    const payment = this.paymentRepo.create({
      invoice,
      student: invoice.student,
      amount: dto.amount.toFixed(2),
      currency: invoice.currency,
      method: dto.method,
      status: PaymentStatus.CONFIRMED,
      recordedBy: { id: requester.userId } as User,
      confirmedVia: ConfirmedVia.MANUAL,
    });
    const saved = await this.paymentRepo.save(payment);
    await this.recomputeInvoiceStatus(invoice);

    // docs/01 §1.3 "real-time for critical (... payment confirmation)" — 'payment' defaults to
    // an immediate push (see notifications.constants.ts's DEFAULT_CHANNEL_BY_CATEGORY); a
    // recipient who's explicitly chosen a digest for this category still gets one instead — the
    // default is what encodes "critical", not a bypass of their preference.
    await this.notifyStudentParty(
      invoice.student.id,
      'payment_confirmed',
      'Payment received',
      `${invoice.currency} ${Number(dto.amount).toFixed(2)} received for ${invoice.billingPeriodStart} – ${invoice.billingPeriodEnd}`,
      { invoiceId: invoice.id, paymentId: saved.id },
    );
    return saved;
  }

  async initiateGatewayPayment(
    requester: AuthenticatedUser,
    dto: InitiateGatewayPaymentDto,
  ): Promise<{ sessionId: string; checkoutUrl: string }> {
    const invoice = await this.getInvoiceOrThrow(dto.invoiceId);
    if (
      !(await this.hasStudentFinanceAccess(
        await this.loadInvoiceStudent(invoice),
        requester,
      ))
    ) {
      throw new ForbiddenException({
        code: 'NOT_AUTHORIZED_FOR_INVOICES',
        message: "You do not have access to this student's invoices",
      });
    }

    const financials = await this.getFinancials(invoice);
    const amountDue = Math.max(financials.netTotal - financials.paidTotal, 0);
    const session = await this.gateway.initiate({
      invoiceId: invoice.id,
      amount: amountDue.toFixed(2),
      currency: invoice.currency,
    });

    await this.paymentRepo.save(
      this.paymentRepo.create({
        invoice,
        student: invoice.student,
        amount: amountDue.toFixed(2),
        currency: invoice.currency,
        method: PaymentMethod.GATEWAY,
        status: PaymentStatus.PENDING,
        gatewayReference: session.sessionId,
        idempotencyKey: session.sessionId,
      }),
    );

    return session;
  }

  // docs/01 §1.5 "payment succeeds but API confirmation fails" — this webhook, never the
  // client's initiate/return response, is what moves a gateway payment to CONFIRMED.
  async confirmGatewayWebhook(
    rawBody: string,
    signatureHeader: string | undefined,
  ): Promise<void> {
    const parsed = this.gateway.verifyAndParseWebhook({
      rawBody,
      signatureHeader,
    });

    const payment = await this.paymentRepo.findOne({
      where: { gatewayReference: parsed.sessionId },
      relations: { invoice: { student: true } },
    });
    if (!payment) return; // unknown session — nothing to reconcile, ack anyway (webhook is one-way)
    if (payment.status !== PaymentStatus.PENDING) return; // already reconciled — idempotent no-op

    const previousStatus = payment.status;
    payment.status =
      parsed.status === 'succeeded'
        ? PaymentStatus.CONFIRMED
        : PaymentStatus.FAILED;
    payment.gatewayReference = parsed.gatewayReference;
    payment.confirmedVia = ConfirmedVia.WEBHOOK;
    await this.paymentRepo.save(payment);

    await this.paymentAuditRepo.save(
      this.paymentAuditRepo.create({
        payment,
        previousStatus,
        newStatus: payment.status,
        changedBy: null,
        note: 'Gateway webhook',
      }),
    );

    if (payment.status === PaymentStatus.CONFIRMED) {
      await this.recomputeInvoiceStatus(payment.invoice);
      await this.notifyStudentParty(
        payment.invoice.student.id,
        'payment_confirmed',
        'Payment received',
        `${payment.invoice.currency} ${Number(payment.amount).toFixed(2)} received for ${payment.invoice.billingPeriodStart} – ${payment.invoice.billingPeriodEnd}`,
        { invoiceId: payment.invoice.id, paymentId: payment.id },
      );
    }
  }

  async refundPayment(
    paymentId: string,
    requester: AuthenticatedUser,
    dto: CreateRefundDto,
  ): Promise<Refund> {
    const payment = await this.paymentRepo.findOne({
      where: { id: paymentId },
      relations: {
        invoice: { student: true, teacherProfile: true, institute: true },
      },
    });
    if (!payment) {
      throw new NotFoundException({
        code: 'PAYMENT_NOT_FOUND',
        message: `Payment ${paymentId} not found`,
      });
    }
    await this.assertInvoiceWriteAccess(payment.invoice, requester);
    if (payment.status !== PaymentStatus.CONFIRMED) {
      throw new ConflictException({
        code: 'PAYMENT_NOT_REFUNDABLE',
        message: 'Only a confirmed payment can be refunded',
      });
    }

    const refund = await this.refundRepo.save(
      this.refundRepo.create({
        payment,
        amount: payment.amount,
        reason: dto.reason,
        status: RefundStatus.PROCESSED,
        processedBy: { id: requester.userId } as User,
        processedAt: new Date(),
      }),
    );

    const previousStatus = payment.status;
    payment.status = PaymentStatus.REFUNDED;
    await this.paymentRepo.save(payment);
    await this.paymentAuditRepo.save(
      this.paymentAuditRepo.create({
        payment,
        previousStatus,
        newStatus: PaymentStatus.REFUNDED,
        changedBy: { id: requester.userId } as User,
        note: dto.reason,
      }),
    );

    await this.recomputeInvoiceStatus(payment.invoice);
    return refund;
  }

  // ---------------------------------------------------------------- Revenue summary ----------

  async getRevenueSummary(
    instituteId: string,
    requester: AuthenticatedUser,
  ): Promise<RevenueSummary> {
    if (requester.activeRole !== 'super_admin') {
      if (
        requester.activeRole !== 'institute_admin' ||
        requester.instituteId !== instituteId
      ) {
        throw new ForbiddenException({
          code: 'NOT_AUTHORIZED_FOR_REVENUE_SUMMARY',
          message: 'You do not have access to this institute’s revenue summary',
        });
      }
    }

    const invoices = await this.invoiceRepo.find({
      where: { institute: { id: instituteId } },
    });
    let totalCollected = 0;
    let totalPending = 0;
    let totalOverdue = 0;
    const currency = invoices[0]?.currency ?? 'INR';

    for (const invoice of invoices) {
      const { netTotal, paidTotal } = await this.getFinancials(invoice);
      totalCollected += paidTotal;
      const outstanding = Math.max(netTotal - paidTotal, 0);
      if (outstanding > 0) {
        if (
          invoice.status === InvoiceStatus.OVERDUE ||
          new Date(invoice.dueDate) < new Date()
        ) {
          totalOverdue += outstanding;
        } else {
          totalPending += outstanding;
        }
      }
    }

    return {
      instituteId,
      totalCollected: round2(totalCollected),
      totalPending: round2(totalPending),
      totalOverdue: round2(totalOverdue),
      currency,
    };
  }

  // ---------------------------------------------------------------- Shared helpers -----------

  private async getFinancials(
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

  private async recomputeInvoiceStatus(invoice: Invoice): Promise<void> {
    if (invoice.status === InvoiceStatus.VOID) return;
    const { netTotal, paidTotal } = await this.getFinancials(invoice);

    let newStatus: InvoiceStatus;
    if (netTotal > 0 && paidTotal >= netTotal) newStatus = InvoiceStatus.PAID;
    else if (paidTotal > 0) newStatus = InvoiceStatus.PARTIAL;
    else if (new Date(invoice.dueDate) < new Date())
      newStatus = InvoiceStatus.OVERDUE;
    else newStatus = InvoiceStatus.ISSUED;

    if (invoice.status !== newStatus) {
      invoice.status = newStatus;
      await this.invoiceRepo.save(invoice);
    }

    // docs/01 §1.5 overpayment → credit balance, consumable against the next invoice.
    if (paidTotal > netTotal) {
      const overpay = round2(paidTotal - netTotal);
      const alreadyCredited = await this.creditLedgerRepo.findOne({
        where: {
          sourceInvoice: { id: invoice.id },
          amount: overpay.toFixed(2),
        },
      });
      if (!alreadyCredited) {
        await this.creditLedgerRepo.save(
          this.creditLedgerRepo.create({
            student: invoice.student,
            amount: overpay.toFixed(2),
            sourceInvoice: invoice,
            note: 'Overpayment credit',
          }),
        );
      }
    }
  }

  private async getAvailableCredit(studentId: string): Promise<number> {
    const entries = await this.creditLedgerRepo.find({
      where: { student: { id: studentId } },
    });
    return round2(entries.reduce((sum, e) => sum + Number(e.amount), 0));
  }

  private async toInvoiceSummary(invoice: Invoice): Promise<InvoiceSummary> {
    const creditNotes = await this.creditNoteRepo.find({
      where: { invoice: { id: invoice.id } },
    });
    const { netTotal, paidTotal } = await this.getFinancials(invoice);
    return {
      id: invoice.id,
      billingPeriodStart: invoice.billingPeriodStart,
      billingPeriodEnd: invoice.billingPeriodEnd,
      subtotal: Number(invoice.subtotal),
      discountTotal: Number(invoice.discountTotal),
      lateFeeTotal: Number(invoice.lateFeeTotal),
      creditNoteTotal: round2(
        creditNotes.reduce((sum, c) => sum + Number(c.amount), 0),
      ),
      totalAmount: round2(netTotal),
      paidTotal: round2(paidTotal),
      currency: invoice.currency,
      status: invoice.status,
      dueDate: invoice.dueDate,
      issuedAt: invoice.issuedAt,
    };
  }

  private async loadInvoiceStudent(invoice: Invoice): Promise<StudentProfile> {
    if (invoice.student) return invoice.student;
    const full = await this.getInvoiceOrThrow(invoice.id);
    return full.student;
  }

  private async getClassOrThrow(classId: string): Promise<Class> {
    const cls = await this.classRepo.findOne({
      where: { id: classId },
      relations: { teacherProfile: true, institute: true },
    });
    if (!cls)
      throw new NotFoundException({
        code: 'CLASS_NOT_FOUND',
        message: `Class ${classId} not found`,
      });
    return cls;
  }

  private async getInvoiceOrThrow(invoiceId: string): Promise<Invoice> {
    const invoice = await this.invoiceRepo.findOne({
      where: { id: invoiceId },
      relations: { student: true, teacherProfile: true, institute: true },
    });
    if (!invoice) {
      throw new NotFoundException({
        code: 'INVOICE_NOT_FOUND',
        message: `Invoice ${invoiceId} not found`,
      });
    }
    return invoice;
  }

  private async assertClassWriteAccess(
    cls: Class,
    requester: AuthenticatedUser,
  ): Promise<void> {
    if (requester.activeRole === 'super_admin') return;
    if (requester.activeRole === 'institute_admin') {
      if (cls.institute?.id && cls.institute.id === requester.instituteId)
        return;
      throw new ForbiddenException({
        code: 'NOT_AUTHORIZED_FOR_FEES',
        message: 'You do not have permission to manage fees for this class',
      });
    }
    const teacherProfile = await this.teacherProfilesService.findByUserId(
      requester.userId,
    );
    if (teacherProfile && teacherProfile.id === cls.teacherProfile.id) return;
    throw new ForbiddenException({
      code: 'NOT_AUTHORIZED_FOR_FEES',
      message: 'You do not have permission to manage fees for this class',
    });
  }

  private async assertInvoiceWriteAccess(
    invoice: Invoice,
    requester: AuthenticatedUser,
  ): Promise<void> {
    if (requester.activeRole === 'super_admin') return;
    if (requester.activeRole === 'institute_admin') {
      if (
        invoice.institute?.id &&
        invoice.institute.id === requester.instituteId
      )
        return;
      throw new ForbiddenException({
        code: 'NOT_AUTHORIZED_FOR_FEES',
        message: 'You do not have permission to manage this invoice',
      });
    }
    const teacherProfile = await this.teacherProfilesService.findByUserId(
      requester.userId,
    );
    if (teacherProfile && teacherProfile.id === invoice.teacherProfile.id)
      return;
    throw new ForbiddenException({
      code: 'NOT_AUTHORIZED_FOR_FEES',
      message: 'You do not have permission to manage this invoice',
    });
  }

  // Mirrors StudentsService/AttendanceService's read-access rule (self / linked guardian /
  // teacher-of-this-student / institute_admin / super_admin) — duplicated per module by design,
  // see attendance.service.ts's equivalent comment.
  private async hasStudentFinanceAccess(
    student: StudentProfile,
    requester: AuthenticatedUser,
  ): Promise<boolean> {
    if (requester.activeRole === 'super_admin') return true;
    if (
      requester.activeRole === 'institute_admin' &&
      student.institute?.id &&
      student.institute.id === requester.instituteId
    ) {
      return true;
    }
    if (student.user?.id === requester.userId) return true;

    const teacherProfile = await this.teacherProfilesService.findByUserId(
      requester.userId,
    );
    if (teacherProfile) {
      const assignment = await this.assignmentRepo.findOne({
        where: {
          student: { id: student.id },
          teacherProfile: { id: teacherProfile.id },
        },
      });
      if (assignment) return true;
    }

    const guardianLink = await this.guardianLinkRepo.findOne({
      where: {
        student: { id: student.id },
        guardian: { user: { id: requester.userId } },
      },
    });
    return !!guardianLink;
  }

  // ---------------------------------------------------------------- Notifications -------------

  // The student's own login (if they have one, docs/03 §3.4 — a minor may not) plus every linked
  // guardian's login (if that guardian has one, docs/03 §3.4 — most are added with contact
  // details only). A student notification-worthy event goes to everyone who'd actually want to
  // know, not just whichever one of them happens to hold the account.
  private async getNotifiableUserIds(studentId: string): Promise<string[]> {
    const ids = new Set<string>();

    const student = await this.studentRepo.findOne({
      where: { id: studentId },
      relations: { user: true },
      select: { id: true, user: { id: true } },
    });
    if (student?.user?.id) ids.add(student.user.id);

    const guardianLinks = await this.guardianLinkRepo.find({
      where: { student: { id: studentId } },
      relations: { guardian: { user: true } },
      select: { id: true, guardian: { id: true, user: { id: true } } },
    });
    for (const link of guardianLinks) {
      if (link.guardian.user?.id) ids.add(link.guardian.user.id);
    }
    return Array.from(ids);
  }

  private async notifyStudentParty(
    studentId: string,
    type: string,
    title: string,
    body: string,
    data?: Record<string, unknown>,
  ): Promise<void> {
    const userIds = await this.getNotifiableUserIds(studentId);
    await Promise.all(
      userIds.map((userId) =>
        this.notificationsService.notify({ userId, type, title, body, data }),
      ),
    );
  }
}
