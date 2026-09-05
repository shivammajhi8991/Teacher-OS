import { IsUUID } from 'class-validator';

export class InitiateGatewayPaymentDto {
  @IsUUID()
  invoiceId: string;
}
