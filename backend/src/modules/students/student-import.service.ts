import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { plainToInstance } from 'class-transformer';
import { validate, ValidationError } from 'class-validator';
import {
  StudentImportJob,
  StudentImportJobStatus,
  StudentImportRowError,
} from './entities/student-import-job.entity';
import { StudentsService } from './students.service';
import { CreateStudentDto } from './dto/create-student.dto';
import { User } from '../users/entities/user.entity';
import { AuthenticatedUser } from '../../common/interfaces/request-with-user.interface';
import { parseCsv } from './utils/csv-parser.util';

export interface StudentImportJobSummary {
  id: string;
  status: StudentImportJobStatus;
  totalRows: number;
  successCount: number;
  failureCount: number;
  errors: StudentImportRowError[];
  createdAt: Date;
  completedAt: Date | null;
}

// docs/04 §4.4 `POST /students/import` "CSV, async job." Previously deliberately skipped (docs/07
// Phase 4 step 3's own note: "the async-job pattern it needs depends on the BullMQ queue that
// arrives with Notifications" — moot now, Notifications never actually wired up BullMQ either;
// this follows the exact fire-and-forget-in-process pattern Reports' export_jobs already
// established, same reasoning). Row-level validation reuses `CreateStudentDto`'s own
// class-validator decorators (`plainToInstance` + `validate`, the same two calls Nest's
// ValidationPipe runs internally for a normal request body) rather than a hand-rolled second set
// of field checks, so a malformed row and a malformed `POST /students` body get identically
// worded errors. `StudentsService.create` is injected directly (same module, not a cross-module
// service call) and does the real create/guardian-link/teacher-assignment work per row — this
// service only owns parsing, per-row validation, and job bookkeeping.
@Injectable()
export class StudentImportService {
  constructor(
    @InjectRepository(StudentImportJob)
    private readonly jobRepo: Repository<StudentImportJob>,
    private readonly studentsService: StudentsService,
  ) {}

  async createImportJob(
    requester: AuthenticatedUser,
    fileBuffer: Buffer,
  ): Promise<StudentImportJobSummary> {
    const rows = parseCsv(fileBuffer.toString('utf-8'));
    if (rows.length === 0) {
      throw new BadRequestException({
        code: 'EMPTY_CSV',
        message: 'The uploaded file has no data rows',
      });
    }

    const job = await this.jobRepo.save(
      this.jobRepo.create({
        requestedBy: { id: requester.userId } as User,
        status: StudentImportJobStatus.PENDING,
        totalRows: rows.length,
      }),
    );

    void this.processImportJob(job.id, requester, rows);

    return this.toSummary(job);
  }

  async getImportJob(
    id: string,
    requester: AuthenticatedUser,
  ): Promise<StudentImportJobSummary> {
    const job = await this.getJobOrThrow(id, requester);
    return this.toSummary(job);
  }

  private async processImportJob(
    jobId: string,
    requester: AuthenticatedUser,
    rows: Array<Record<string, string>>,
  ): Promise<void> {
    const job = await this.jobRepo.findOne({ where: { id: jobId } });
    if (!job) return;
    job.status = StudentImportJobStatus.PROCESSING;
    await this.jobRepo.save(job);

    const errors: StudentImportRowError[] = [];
    let successCount = 0;

    for (const [index, row] of rows.entries()) {
      const rowNumber = index + 2; // header is row 1, so the first data row is row 2
      try {
        const dto = await this.rowToValidatedDto(row);
        await this.studentsService.create(requester.userId, dto);
        successCount++;
      } catch (err) {
        errors.push({
          row: rowNumber,
          message: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    }

    job.status =
      successCount === 0
        ? StudentImportJobStatus.FAILED
        : StudentImportJobStatus.COMPLETED;
    job.successCount = successCount;
    job.failureCount = errors.length;
    job.errors = errors;
    job.completedAt = new Date();
    await this.jobRepo.save(job);
  }

  // Expected columns (header row): fullName (required), dob, gender, joinDate,
  // emergencyContactName, emergencyContactPhone, medicalNotes, guardianFullName, guardianPhone,
  // guardianEmail, guardianRelationship. Exactly one guardian per row (a real bulk-import CSV
  // realistically carries one primary guardian per student) — additional guardians are still
  // reachable one-by-one afterward via the existing `POST /students/:id/guardians`.
  private async rowToValidatedDto(
    row: Record<string, string>,
  ): Promise<CreateStudentDto> {
    if (!row.fullName) {
      throw new Error('fullName is required');
    }
    const plain: Record<string, unknown> = {
      fullName: row.fullName,
      dob: row.dob || undefined,
      gender: row.gender || undefined,
      joinDate: row.joinDate || undefined,
      emergencyContactName: row.emergencyContactName || undefined,
      emergencyContactPhone: row.emergencyContactPhone || undefined,
      medicalNotes: row.medicalNotes || undefined,
    };
    if (row.guardianFullName) {
      plain.guardians = [
        {
          fullName: row.guardianFullName,
          phone: row.guardianPhone || undefined,
          email: row.guardianEmail || undefined,
          relationship: row.guardianRelationship || undefined,
        },
      ];
    }

    const dto = plainToInstance(CreateStudentDto, plain);
    const validationErrors = await validate(dto);
    if (validationErrors.length > 0) {
      const messages = flattenValidationMessages(validationErrors);
      throw new Error(messages.join('; ') || 'Invalid row');
    }
    return dto;
  }

  private async getJobOrThrow(
    id: string,
    requester: AuthenticatedUser,
  ): Promise<StudentImportJob> {
    const job = await this.jobRepo.findOne({
      where: { id },
      relations: { requestedBy: true },
    });
    if (!job) {
      throw new NotFoundException({
        code: 'IMPORT_JOB_NOT_FOUND',
        message: `Import job ${id} not found`,
      });
    }
    if (
      job.requestedBy.id !== requester.userId &&
      requester.activeRole !== 'super_admin'
    ) {
      throw new ForbiddenException({
        code: 'NOT_AUTHORIZED_FOR_IMPORT_JOB',
        message: 'You can only view your own import jobs',
      });
    }
    return job;
  }

  private toSummary(job: StudentImportJob): StudentImportJobSummary {
    return {
      id: job.id,
      status: job.status,
      totalRows: job.totalRows,
      successCount: job.successCount,
      failureCount: job.failureCount,
      errors: job.errors,
      createdAt: job.createdAt,
      completedAt: job.completedAt ?? null,
    };
  }
}

// A real bug caught live testing this exact import flow: `class-validator`'s `ValidationError`
// is a tree, not a flat list — a failure inside a `@ValidateNested` property (here, the
// `guardians` array) lands in that error's `children`, not its own `constraints`, so reading
// only `error.constraints` silently drops every nested-object validation message (a bad
// `guardianEmail` fell through to the generic "Invalid row" instead of naming the actual
// problem). Recurses through `children` to collect every leaf's messages.
function flattenValidationMessages(errors: ValidationError[]): string[] {
  return errors.flatMap((error) => [
    ...Object.values(error.constraints ?? {}),
    ...flattenValidationMessages(error.children ?? []),
  ]);
}
