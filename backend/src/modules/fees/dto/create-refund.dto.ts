import { IsString } from 'class-validator';

// docs/04 §4.4 POST /payments/:id/refund. Full-amount only in this pass — see refund.entity.ts.
export class CreateRefundDto {
  @IsString()
  reason: string;
}
