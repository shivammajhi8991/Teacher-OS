import { IsIn } from 'class-validator';
import { UserStatus } from '../entities/user.entity';

// Deliberately excludes 'pending_verification' — that status is set by the system at
// registration, never something an admin assigns back to; the only admin-driven transition is
// suspend ↔ reactivate.
export class UpdateUserStatusDto {
  @IsIn([UserStatus.ACTIVE, UserStatus.SUSPENDED])
  status: UserStatus.ACTIVE | UserStatus.SUSPENDED;
}
