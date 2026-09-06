import { IsNumber, Max, Min } from 'class-validator';

export class SetPayoutPercentDto {
  @IsNumber()
  @Min(0)
  @Max(100)
  payoutPercent: number;
}
