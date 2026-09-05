import { IsIn, IsOptional, IsUUID } from 'class-validator';

// docs/04 §4.4 POST /classes/:id/enrollments. Defaults to a regular ('active') enrollment;
// 'trial' matches the spec's "trial class / drop-in session" support (docs/01 §1.3) — same
// enrollment mechanism, just a different `status` value, not a separate table.
export class EnrollStudentDto {
  @IsUUID()
  studentId: string;

  @IsOptional()
  @IsIn(['active', 'trial'])
  enrollmentType?: 'active' | 'trial';
}
