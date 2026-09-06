import { IsOptional, IsString } from 'class-validator';

// docs/04 §4.4 PATCH /assignment-submissions/:id/review. Both fields optional — a teacher can
// mark a submission reviewed with just feedback, just a grade, or both.
export class ReviewSubmissionDto {
  @IsOptional()
  @IsString()
  grade?: string;

  @IsOptional()
  @IsString()
  feedback?: string;
}
