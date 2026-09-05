import { IsIn, IsNumber, IsString, IsUUID, Min } from 'class-validator';
import { PaymentMethod } from '../entities/payment.entity';

// docs/04 §4.4 POST /payments — offline record (cash/UPI/bank). `idempotencyKey` is
// client-generated (docs/01 §1.5 "duplicate payment") — a retry with the same key returns the
// original payment rather than recording money twice.
export class CreatePaymentDto {
  @IsUUID()
  invoiceId: string;

  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsIn([PaymentMethod.CASH, PaymentMethod.UPI, PaymentMethod.BANK_TRANSFER])
  method: PaymentMethod; // 'gateway' payments only ever originate from the initiate/webhook pair

  @IsString()
  idempotencyKey: string;
}
