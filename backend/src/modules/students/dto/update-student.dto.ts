import { IsDateString, IsIn, IsOptional, IsString } from 'class-validator';
import { EnrollmentStatus } from '../entities/student-profile.entity';

// docs/04 §4.4 PATCH /students/:id. `enrollmentStatus` intentionally excludes 'archived' — that
// transition only happens through POST /students/:id/archive, kept as its own deliberate,
// separately-permissioned action rather than a value this generic PATCH can also set (docs/01
// §1.3 "archive old students instead of permanently deleting them" reads as a distinct action,
// not a field edit).
export class UpdateStudentDto {
  @IsOptional()
  @IsString()
  fullName?: string;

  @IsOptional()
  @IsDateString()
  dob?: string;

  @IsOptional()
  @IsString()
  gender?: string;

  @IsOptional()
  @IsString()
  avatarUrl?: string;

  @IsOptional()
  @IsString()
  emergencyContactName?: string;

  @IsOptional()
  @IsString()
  emergencyContactPhone?: string;

  @IsOptional()
  @IsString()
  medicalNotes?: string;

  @IsOptional()
  @IsIn([
    EnrollmentStatus.ACTIVE,
    EnrollmentStatus.INACTIVE,
    EnrollmentStatus.LEFT,
  ])
  enrollmentStatus?: EnrollmentStatus;
}
