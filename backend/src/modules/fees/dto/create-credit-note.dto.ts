import { IsNumber, IsString, Min } from 'class-validator';

export class CreateCreditNoteDto {
  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsString()
  reason: string;
}
