import { Test } from '@nestjs/testing';
import { ConflictException, ForbiddenException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { FeesService } from './fees.service';
import { FeeStructure } from './entities/fee-structure.entity';
import { Discount } from './entities/discount.entity';
import { Invoice, InvoiceStatus } from './entities/invoice.entity';
import { InvoiceLineItem } from './entities/invoice-line-item.entity';
import { CreditNote } from './entities/credit-note.entity';
import { Payment, PaymentStatus } from './entities/payment.entity';
import { PaymentAuditLog } from './entities/payment-audit-log.entity';
import { Refund } from './entities/refund.entity';
import { StudentCreditLedgerEntry } from './entities/student-credit-ledger-entry.entity';
import { Class } from '../classes/entities/class.entity';
import { Institute } from '../institutes/entities/institute.entity';
import { Enrollment } from '../classes/entities/enrollment.entity';
import { StudentProfile } from '../students/entities/student-profile.entity';
import { StudentGuardianLink } from '../students/entities/student-guardian-link.entity';
import { StudentTeacherAssignment } from '../students/entities/student-teacher-assignment.entity';
import { AttendanceSession } from '../attendance/entities/attendance-session.entity';
import { AttendanceRecord } from '../attendance/entities/attendance-record.entity';
import { TeacherProfilesService } from '../teacher-profiles/teacher-profiles.service';
import { PAYMENT_GATEWAY_ADAPTER } from './gateway/payment-gateway.adapter';
import { AuthenticatedUser } from '../../common/interfaces/request-with-user.interface';

// docs/05 §5.7-equivalent for the backend: docs/01 §1.5's named financial edge cases — duplicate
// payment, overpayment → credit, refunding an already-refunded/failed payment, and the
// attendance-based proration math that ties Attendance and Fees together.
describe('FeesService', () => {
  let service: FeesService;
  const feeStructureRepo = {
    create: jest.fn((d) => d),
    save: jest.fn((d) => Promise.resolve({ id: 'fs-1', ...d })),
    find: jest.fn(),
    findOne: jest.fn(),
  };
  const discountRepo = { find: jest.fn().mockResolvedValue([]) };
  const invoiceRepo = {
    create: jest.fn((d) => d),
    save: jest.fn((d) => Promise.resolve({ id: 'invoice-1', ...d })),
    find: jest.fn(),
    findOne: jest.fn(),
  };
  const lineItemRepo = {
    create: jest.fn((d) => d),
    save: jest.fn((d) => Promise.resolve(d)),
  };
  const creditNoteRepo = {
    create: jest.fn((d) => d),
    save: jest.fn((d) => Promise.resolve(d)),
    find: jest.fn().mockResolvedValue([]),
  };
  const paymentRepo = {
    create: jest.fn((d) => d),
    save: jest.fn((d) => Promise.resolve({ id: 'payment-1', ...d })),
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn(),
  };
  const paymentAuditRepo = {
    create: jest.fn((d) => d),
    save: jest.fn((d) => Promise.resolve(d)),
  };
  const refundRepo = {
    create: jest.fn((d) => d),
    save: jest.fn((d) => Promise.resolve({ id: 'refund-1', ...d })),
  };
  const creditLedgerRepo = {
    create: jest.fn((d) => d),
    save: jest.fn((d) => Promise.resolve(d)),
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue(null),
  };
  const classRepo = { findOne: jest.fn() };
  const instituteRepo = { findOne: jest.fn() };
  const enrollmentRepo = { find: jest.fn().mockResolvedValue([]) };
  const studentRepo = { findOne: jest.fn() };
  const guardianLinkRepo = { findOne: jest.fn() };
  const assignmentRepo = { findOne: jest.fn() };
  const attendanceSessionRepo = { find: jest.fn().mockResolvedValue([]) };
  const attendanceRecordRepo = { count: jest.fn().mockResolvedValue(0) };
  const teacherProfilesService = { findByUserId: jest.fn() };
  const gateway = { initiate: jest.fn(), verifyAndParseWebhook: jest.fn() };

  const teacher: AuthenticatedUser = {
    userId: 'user-teacher',
    activeRole: 'teacher',
    instituteId: null,
  };
  const cls = {
    id: 'class-1',
    name: 'Guitar Batch',
    institute: null,
    teacherProfile: { id: 'teacher-profile-1' },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        FeesService,
        {
          provide: getRepositoryToken(FeeStructure),
          useValue: feeStructureRepo,
        },
        { provide: getRepositoryToken(Discount), useValue: discountRepo },
        { provide: getRepositoryToken(Invoice), useValue: invoiceRepo },
        {
          provide: getRepositoryToken(InvoiceLineItem),
          useValue: lineItemRepo,
        },
        { provide: getRepositoryToken(CreditNote), useValue: creditNoteRepo },
        { provide: getRepositoryToken(Payment), useValue: paymentRepo },
        {
          provide: getRepositoryToken(PaymentAuditLog),
          useValue: paymentAuditRepo,
        },
        { provide: getRepositoryToken(Refund), useValue: refundRepo },
        {
          provide: getRepositoryToken(StudentCreditLedgerEntry),
          useValue: creditLedgerRepo,
        },
        { provide: getRepositoryToken(Class), useValue: classRepo },
        { provide: getRepositoryToken(Institute), useValue: instituteRepo },
        { provide: getRepositoryToken(Enrollment), useValue: enrollmentRepo },
        { provide: getRepositoryToken(StudentProfile), useValue: studentRepo },
        {
          provide: getRepositoryToken(StudentGuardianLink),
          useValue: guardianLinkRepo,
        },
        {
          provide: getRepositoryToken(StudentTeacherAssignment),
          useValue: assignmentRepo,
        },
        {
          provide: getRepositoryToken(AttendanceSession),
          useValue: attendanceSessionRepo,
        },
        {
          provide: getRepositoryToken(AttendanceRecord),
          useValue: attendanceRecordRepo,
        },
        { provide: TeacherProfilesService, useValue: teacherProfilesService },
        { provide: PAYMENT_GATEWAY_ADAPTER, useValue: gateway },
      ],
    }).compile();

    service = module.get(FeesService);

    // Safe, explicit defaults for every test — jest.clearAllMocks() clears call history but NOT
    // a mock's last-set resolved value, so without this, a value set by one test could leak into
    // the next. Each test below only overrides the handful of these it actually cares about.
    classRepo.findOne.mockResolvedValue(cls);
    teacherProfilesService.findByUserId.mockResolvedValue({
      id: 'teacher-profile-1',
    });
    paymentRepo.findOne.mockResolvedValue(null);
    paymentRepo.find.mockResolvedValue([]);
    invoiceRepo.findOne.mockResolvedValue(null);
    creditNoteRepo.find.mockResolvedValue([]);
    discountRepo.find.mockResolvedValue([]);
    creditLedgerRepo.find.mockResolvedValue([]);
    creditLedgerRepo.findOne.mockResolvedValue(null);
    attendanceSessionRepo.find.mockResolvedValue([]);
    attendanceRecordRepo.count.mockResolvedValue(0);
    enrollmentRepo.find.mockResolvedValue([]);
  });

  describe('createFeeStructure', () => {
    it("rejects a teacher who doesn't teach this class", async () => {
      teacherProfilesService.findByUserId.mockResolvedValue({
        id: 'someone-elses-profile',
      });

      await expect(
        service.createFeeStructure(teacher, {
          classId: 'class-1',
          billingModel: 'monthly' as any,
          amount: 1000,
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(feeStructureRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('recordPayment', () => {
    const invoice = {
      id: 'invoice-1',
      student: { id: 'student-1' },
      institute: null,
      teacherProfile: { id: 'teacher-profile-1' },
      totalAmount: '1000.00',
      currency: 'INR',
      status: InvoiceStatus.ISSUED,
      dueDate: '2099-01-01', // far future — never "overdue" in this test
    };

    it('returns the existing payment on a duplicate idempotency key rather than double-charging', async () => {
      const existingPayment = { id: 'payment-existing', amount: '1000.00' };
      paymentRepo.findOne.mockResolvedValue(existingPayment);

      const result = await service.recordPayment(teacher, {
        invoiceId: 'invoice-1',
        amount: 1000,
        method: 'cash' as any,
        idempotencyKey: 'key-1',
      });

      expect(result).toBe(existingPayment);
      expect(invoiceRepo.findOne).not.toHaveBeenCalled(); // never even looked up the invoice again
      expect(paymentRepo.save).not.toHaveBeenCalled();
    });

    it('marks the invoice PAID once a full payment is recorded', async () => {
      paymentRepo.findOne.mockResolvedValueOnce(null); // no existing payment for this key
      invoiceRepo.findOne.mockResolvedValue(invoice);
      paymentRepo.find.mockResolvedValue([
        { status: PaymentStatus.CONFIRMED, amount: '1000.00' },
      ]);

      await service.recordPayment(teacher, {
        invoiceId: 'invoice-1',
        amount: 1000,
        method: 'cash' as any,
        idempotencyKey: 'key-2',
      });

      expect(invoiceRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: InvoiceStatus.PAID }),
      );
    });

    it('grants a credit-ledger entry when the recorded payment overpays the invoice', async () => {
      paymentRepo.findOne.mockResolvedValueOnce(null);
      invoiceRepo.findOne.mockResolvedValue(invoice);
      paymentRepo.find.mockResolvedValue([
        { status: PaymentStatus.CONFIRMED, amount: '1200.00' },
      ]);

      await service.recordPayment(teacher, {
        invoiceId: 'invoice-1',
        amount: 1200,
        method: 'cash' as any,
        idempotencyKey: 'key-3',
      });

      expect(creditLedgerRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ amount: '200.00' }),
      );
    });
  });

  describe('refundPayment', () => {
    it('rejects refunding a payment that is not currently confirmed', async () => {
      paymentRepo.findOne.mockResolvedValue({
        id: 'payment-1',
        status: PaymentStatus.REFUNDED,
        invoice: {
          id: 'invoice-1',
          teacherProfile: { id: 'teacher-profile-1' },
          institute: null,
        },
      });

      await expect(
        service.refundPayment('payment-1', teacher, {
          reason: 'duplicate charge',
        }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(refundRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('generateInvoices — attendance-based proration', () => {
    it('deducts the per-class amount for each absent held session when the policy is per_class_deduction', async () => {
      feeStructureRepo.findOne.mockResolvedValue({
        id: 'fs-1',
        amount: '1000.00',
        currency: 'INR',
        prorationPolicy: 'per_class_deduction',
      });
      enrollmentRepo.find.mockResolvedValue([
        {
          student: { id: 'student-1' },
          enrolledFrom: '2026-01-01',
          enrolledTo: null,
        },
      ]);
      invoiceRepo.findOne.mockResolvedValue(null); // not already generated for this period
      attendanceSessionRepo.find.mockResolvedValue([
        { id: 's1' },
        { id: 's2' },
        { id: 's3' },
        { id: 's4' },
      ]); // 4 held
      attendanceRecordRepo.count.mockResolvedValue(1); // 1 absence out of 4 → 25% deduction

      const [summary] = await service.generateInvoices(teacher, {
        classId: 'class-1',
        billingPeriodStart: '2026-01-01',
        billingPeriodEnd: '2026-01-31',
        dueDate: '2026-02-05',
      });

      // 1000 / 4 held sessions = 250 per class; 1 absence → 250 deducted → total 750.
      expect(summary.subtotal).toBe(1000);
      expect(summary.totalAmount).toBe(750);
    });
  });
});
