import {
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { DiscountType } from '../entities/discount.entity';

// docs/04 §4.4. Exactly one of studentId/classId is required — enforced in the service (a
// class-validator cross-field "exactly one of" is awkward to express cleanly), matching the
// pattern already used for CreateStudentDto's email-or-phone check.
export class CreateDiscountDto {
  @IsOptional()
  @IsUUID()
  studentId?: string;

  @IsOptional()
  @IsUUID()
  classId?: string;

  @IsIn([DiscountType.FLAT, DiscountType.PERCENT])
  type: DiscountType;

  @IsNumber()
  @Min(0)
  value: number;

  @IsOptional()
  @IsString()
  reason?: string;
}
