import {
  IsIn,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import {
  BillingModel,
  ProrationPolicy,
} from '../entities/fee-structure.entity';

// docs/04 §4.4 POST /fee-structures. Scoped to exactly one class in this pass (institute/teacher-
// wide fee structures are a documented follow-up) — invoice generation (docs/03 §3.7) resolves
// the fee structure to charge per class, so tying creation to a classId keeps that resolution
// unambiguous without needing a "which structure applies" precedence rule yet.
export class CreateFeeStructureDto {
  @IsUUID()
  classId: string;

  @IsIn([
    BillingModel.MONTHLY,
    BillingModel.PER_CLASS,
    BillingModel.COURSE,
    BillingModel.HOURLY,
    BillingModel.CUSTOM,
    BillingModel.ONE_TIME_REGISTRATION,
  ])
  billingModel: BillingModel;

  @IsNumber()
  @Min(0)
  amount: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsIn([
    ProrationPolicy.NONE,
    ProrationPolicy.PER_CLASS_DEDUCTION,
    ProrationPolicy.MANUAL_ADJUSTMENT_ONLY,
  ])
  prorationPolicy?: ProrationPolicy;

  @IsOptional()
  @IsObject()
  lateFeeRule?: Record<string, unknown>;
}
