import { Test } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { StudentImportService } from './student-import.service';
import {
  StudentImportJob,
  StudentImportJobStatus,
} from './entities/student-import-job.entity';
import { StudentsService } from './students.service';
import { AuthenticatedUser } from '../../common/interfaces/request-with-user.interface';

const flushAsync = () => new Promise((resolve) => setImmediate(resolve));

// docs/04 §4.4/§4.7 "CSV, async job" — the highest-value tests here are the ones covering
// docs/01 §1.5's "bulk operation fails partway" edge case explicitly: one malformed row never
// aborts the rest of the import.
describe('StudentImportService', () => {
  let service: StudentImportService;
  const jobRepo = {
    create: jest.fn((d) => d),
    save: jest.fn((d) =>
      Promise.resolve({ id: 'job-1', createdAt: new Date(), errors: [], ...d }),
    ),
    findOne: jest.fn(),
  };
  const studentsService = { create: jest.fn() };

  const teacher: AuthenticatedUser = {
    userId: 'user-teacher',
    activeRole: 'teacher',
    instituteId: null,
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        StudentImportService,
        { provide: getRepositoryToken(StudentImportJob), useValue: jobRepo },
        { provide: StudentsService, useValue: studentsService },
      ],
    }).compile();
    service = module.get(StudentImportService);
  });

  describe('createImportJob', () => {
    it('rejects a CSV with no data rows', async () => {
      const buffer = Buffer.from('fullName,dob', 'utf-8');
      await expect(service.createImportJob(teacher, buffer)).rejects.toThrow(
        BadRequestException,
      );
      expect(jobRepo.save).not.toHaveBeenCalled();
    });

    it('creates a PENDING job immediately, without waiting for row processing', async () => {
      const buffer = Buffer.from('fullName\nJamie Lee', 'utf-8');
      const summary = await service.createImportJob(teacher, buffer);
      expect(summary.status).toBe(StudentImportJobStatus.PENDING);
      expect(summary.totalRows).toBe(1);
    });
  });

  describe('background row processing', () => {
    it('creates a student per valid row and marks the job COMPLETED', async () => {
      const job = {
        id: 'job-1',
        requestedBy: { id: 'user-teacher' },
        status: StudentImportJobStatus.PENDING,
        totalRows: 2,
        errors: [] as unknown[],
        createdAt: new Date(),
      };
      jobRepo.save.mockImplementation((d) => Promise.resolve({ ...job, ...d }));
      jobRepo.findOne.mockResolvedValue(job);
      studentsService.create.mockResolvedValue({ id: 'student-1' });

      const buffer = Buffer.from(
        'fullName,dob\nJamie Lee,2015-01-01\nAlex Kim,2016-06-15',
        'utf-8',
      );
      await service.createImportJob(teacher, buffer);
      await flushAsync();

      expect(studentsService.create).toHaveBeenCalledTimes(2);
      expect(jobRepo.save).toHaveBeenLastCalledWith(
        expect.objectContaining({
          status: StudentImportJobStatus.COMPLETED,
          successCount: 2,
          failureCount: 0,
        }),
      );
    });

    it('records a row missing fullName as a failure without aborting the rest', async () => {
      const job = {
        id: 'job-1',
        requestedBy: { id: 'user-teacher' },
        status: StudentImportJobStatus.PENDING,
        totalRows: 2,
        errors: [] as unknown[],
        createdAt: new Date(),
      };
      jobRepo.save.mockImplementation((d) => Promise.resolve({ ...job, ...d }));
      jobRepo.findOne.mockResolvedValue(job);
      studentsService.create.mockResolvedValue({ id: 'student-1' });

      // Row 1 has no fullName (blank first column); row 2 is valid.
      const buffer = Buffer.from(
        'fullName,dob\n,2015-01-01\nAlex Kim,2016-06-15',
        'utf-8',
      );
      await service.createImportJob(teacher, buffer);
      await flushAsync();

      expect(studentsService.create).toHaveBeenCalledTimes(1);
      expect(jobRepo.save).toHaveBeenLastCalledWith(
        expect.objectContaining({
          status: StudentImportJobStatus.COMPLETED,
          successCount: 1,
          failureCount: 1,
          errors: [
            expect.objectContaining({
              row: 2,
              message: expect.stringContaining('fullName'),
            }),
          ],
        }),
      );
    });

    it('records an invalid guardian email as a row-level validation failure, naming the real reason', async () => {
      // Regression guard for a real bug caught live testing this exact flow: `guardianEmail`
      // fails validation *inside* the nested `guardians` array (`@ValidateNested`), which
      // class-validator reports via `ValidationError.children`, not the top-level error's own
      // `constraints` — reading only the latter silently dropped this message down to a generic
      // "Invalid row" instead of naming the actual problem (see `flattenValidationMessages`).
      const job = {
        id: 'job-1',
        requestedBy: { id: 'user-teacher' },
        status: StudentImportJobStatus.PENDING,
        totalRows: 1,
        errors: [] as unknown[],
        createdAt: new Date(),
      };
      jobRepo.save.mockImplementation((d) => Promise.resolve({ ...job, ...d }));
      jobRepo.findOne.mockResolvedValue(job);

      const buffer = Buffer.from(
        'fullName,guardianFullName,guardianEmail\nJamie Lee,Jane Doe,not-an-email',
        'utf-8',
      );
      await service.createImportJob(teacher, buffer);
      await flushAsync();

      expect(studentsService.create).not.toHaveBeenCalled();
      expect(jobRepo.save).toHaveBeenLastCalledWith(
        expect.objectContaining({
          status: StudentImportJobStatus.FAILED,
          failureCount: 1,
          errors: [
            expect.objectContaining({
              message: expect.stringContaining('email'),
            }),
          ],
        }),
      );
    });

    it('marks the job FAILED when every row fails', async () => {
      const job = {
        id: 'job-1',
        requestedBy: { id: 'user-teacher' },
        status: StudentImportJobStatus.PENDING,
        totalRows: 1,
        errors: [] as unknown[],
        createdAt: new Date(),
      };
      jobRepo.save.mockImplementation((d) => Promise.resolve({ ...job, ...d }));
      jobRepo.findOne.mockResolvedValue(job);
      studentsService.create.mockRejectedValue(
        new Error('Complete your teacher profile'),
      );

      const buffer = Buffer.from('fullName\nJamie Lee', 'utf-8');
      await service.createImportJob(teacher, buffer);
      await flushAsync();

      expect(jobRepo.save).toHaveBeenLastCalledWith(
        expect.objectContaining({
          status: StudentImportJobStatus.FAILED,
          successCount: 0,
        }),
      );
    });
  });

  describe('getImportJob', () => {
    it("rejects reading another user's import job", async () => {
      jobRepo.findOne.mockResolvedValue({
        id: 'job-1',
        requestedBy: { id: 'someone-else' },
        status: StudentImportJobStatus.COMPLETED,
      });
      await expect(service.getImportJob('job-1', teacher)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('404s for a nonexistent job', async () => {
      jobRepo.findOne.mockResolvedValue(null);
      await expect(service.getImportJob('missing', teacher)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
