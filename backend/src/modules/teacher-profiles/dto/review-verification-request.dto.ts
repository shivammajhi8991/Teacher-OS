import { IsIn, IsOptional, IsString } from 'class-validator';

export class ReviewVerificationRequestDto {
  @IsIn(['approved', 'rejected'])
  decision: 'approved' | 'rejected';

  @IsOptional()
  @IsString()
  rejectionReason?: string;
}
