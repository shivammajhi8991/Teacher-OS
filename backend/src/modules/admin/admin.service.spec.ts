import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AdminService } from './admin.service';
import { AttendanceAuditLog } from '../attendance/entities/attendance-audit-log.entity';
import { PaymentAuditLog } from '../fees/entities/payment-audit-log.entity';
import { AuthenticatedUser } from '../../common/interfaces/request-with-user.interface';

// A chainable QueryBuilder stub, matching admin-users.service.spec.ts's own precedent — every
// method returns `this` except the terminal `getMany()`.
function createQueryBuilderStub(result: unknown[]) {
  const qb: Record<string, jest.Mock> = {};
  const chain = [
    'leftJoinAndSelect',
    'leftJoin',
    'andWhere',
    'orderBy',
    'take',
  ];
  for (const method of chain) {
    qb[method] = jest.fn().mockReturnValue(qb);
  }
  qb.getMany = jest.fn().mockResolvedValue(result);
  return qb;
}

describe('AdminService', () => {
  let service: AdminService;
  const attendanceAuditRepo = { createQueryBuilder: jest.fn() };
  const paymentAuditRepo = { createQueryBuilder: jest.fn() };

  const superAdmin: AuthenticatedUser = {
    userId: 'user-super',
    activeRole: 'super_admin',
    instituteId: null,
  };
  const instituteAdmin: AuthenticatedUser = {
    userId: 'user-admin',
    activeRole: 'institute_admin',
    instituteId: 'institute-1',
  };

  const attendanceRow = {
    id: 'att-log-1',
    previousStatus: 'present',
    newStatus: 'absent',
    changedBy: { fullName: 'Meera Joshi' },
    changedAt: new Date('2026-02-01T10:00:00Z'),
    reason: 'Parent called in',
  };
  const paymentRow = {
    id: 'pay-log-1',
    previousStatus: 'pending',
    newStatus: 'confirmed',
    changedBy: null, // webhook-driven — no human changedBy
    changedAt: new Date('2026-02-01T09:00:00Z'),
    note: null,
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        AdminService,
        {
          provide: getRepositoryToken(AttendanceAuditLog),
          useValue: attendanceAuditRepo,
        },
        {
          provide: getRepositoryToken(PaymentAuditLog),
          useValue: paymentAuditRepo,
        },
      ],
    }).compile();
    service = module.get(AdminService);
  });

  it('returns nothing and never queries the repos for an institute_admin with no institute', async () => {
    const result = await service.listAuditLog(
      { userId: 'u', activeRole: 'institute_admin', instituteId: null },
      { limit: 50 },
    );
    expect(result).toEqual({ entries: [], nextCursor: null });
    expect(attendanceAuditRepo.createQueryBuilder).not.toHaveBeenCalled();
    expect(paymentAuditRepo.createQueryBuilder).not.toHaveBeenCalled();
  });

  it('merges both sources newest-first and maps a webhook-driven entry to a null changedByName', async () => {
    attendanceAuditRepo.createQueryBuilder.mockReturnValue(
      createQueryBuilderStub([attendanceRow]),
    );
    paymentAuditRepo.createQueryBuilder.mockReturnValue(
      createQueryBuilderStub([paymentRow]),
    );

    const result = await service.listAuditLog(superAdmin, { limit: 50 });

    expect(result.entries.map((e) => e.source)).toEqual([
      'attendance',
      'payment',
    ]);
    expect(result.entries[0].changedByName).toBe('Meera Joshi');
    expect(result.entries[1].changedByName).toBeNull();
  });

  it("scopes an institute_admin's query to their own institute on both sources", async () => {
    const attendanceQb = createQueryBuilderStub([]);
    const paymentQb = createQueryBuilderStub([]);
    attendanceAuditRepo.createQueryBuilder.mockReturnValue(attendanceQb);
    paymentAuditRepo.createQueryBuilder.mockReturnValue(paymentQb);

    await service.listAuditLog(instituteAdmin, { limit: 50 });

    expect(attendanceQb.andWhere).toHaveBeenCalledWith(
      'class.institute_id = :instituteId',
      {
        instituteId: 'institute-1',
      },
    );
    expect(paymentQb.andWhere).toHaveBeenCalledWith(
      'invoice.institute_id = :instituteId',
      {
        instituteId: 'institute-1',
      },
    );
  });

  it('adds no institute filter for super_admin', async () => {
    const attendanceQb = createQueryBuilderStub([]);
    paymentAuditRepo.createQueryBuilder.mockReturnValue(
      createQueryBuilderStub([]),
    );
    attendanceAuditRepo.createQueryBuilder.mockReturnValue(attendanceQb);

    await service.listAuditLog(superAdmin, { limit: 50 });

    expect(attendanceQb.andWhere).not.toHaveBeenCalledWith(
      expect.stringContaining('institute_id'),
      expect.anything(),
    );
  });

  it('queries only the requested source when `source` is given', async () => {
    const attendanceQb = createQueryBuilderStub([attendanceRow]);
    attendanceAuditRepo.createQueryBuilder.mockReturnValue(attendanceQb);

    await service.listAuditLog(superAdmin, { source: 'attendance', limit: 50 });

    expect(attendanceAuditRepo.createQueryBuilder).toHaveBeenCalled();
    expect(paymentAuditRepo.createQueryBuilder).not.toHaveBeenCalled();
  });

  it('returns a nextCursor only when a source may have more rows, using the last entry’s changedAt', async () => {
    // Exactly `limit` rows back from one source is the real "maybe more" signal this
    // approximate cross-source pagination uses — see the service's own class doc comment.
    const fullPage = Array.from({ length: 2 }, (_, i) => ({
      ...attendanceRow,
      id: `att-log-${i}`,
      changedAt: new Date(2026, 1, 1, 10 - i),
    }));
    attendanceAuditRepo.createQueryBuilder.mockReturnValue(
      createQueryBuilderStub(fullPage),
    );
    paymentAuditRepo.createQueryBuilder.mockReturnValue(
      createQueryBuilderStub([]),
    );

    const result = await service.listAuditLog(superAdmin, { limit: 2 });

    expect(result.nextCursor).toBe(
      result.entries.at(-1)!.changedAt.toISOString(),
    );
  });
});
