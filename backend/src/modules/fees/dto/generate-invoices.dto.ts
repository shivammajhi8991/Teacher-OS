import { IsString, IsUUID } from 'class-validator';

// docs/04 §4.4 POST /invoices/generate — "batch-generate for a billing period." Scoped to one
// class per call in this pass; a teacher generating for all their classes at once is a thin loop
// over this endpoint, not a documented gap (docs/07's mobile scope covers one class at a time,
// matching how fee structures are also scoped per class).
export class GenerateInvoicesDto {
  @IsUUID()
  classId: string;

  @IsString()
  billingPeriodStart: string;

  @IsString()
  billingPeriodEnd: string;

  @IsString()
  dueDate: string;
}
