import { IsIn, IsOptional, IsString } from 'class-validator';
import { UserStatus } from '../entities/user.entity';

export class SearchUsersQueryDto {
  @IsOptional()
  @IsString()
  q?: string; // matched against fullName/email/phone

  @IsOptional()
  @IsIn([
    UserStatus.ACTIVE,
    UserStatus.SUSPENDED,
    UserStatus.PENDING_VERIFICATION,
  ])
  status?: UserStatus;
}
