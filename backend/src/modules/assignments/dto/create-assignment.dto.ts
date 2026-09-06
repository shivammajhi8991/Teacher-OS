import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

// docs/04 §4.4 POST /assignments. Exactly one of classId/studentId is required — enforced in
// AssignmentsService, matching the "exactly one of" pattern used elsewhere in this codebase
// (see assignment.entity.ts's header comment).
export class CreateAssignmentDto {
  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsUUID()
  classId?: string;

  @IsOptional()
  @IsUUID()
  studentId?: string;

  @IsDateString()
  dueAt: string;

  @IsOptional()
  @IsBoolean()
  allowLateSubmission?: boolean;

  @IsOptional()
  @IsBoolean()
  allowResubmission?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  attachmentUrls?: string[];
}
