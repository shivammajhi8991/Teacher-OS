import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { RoleName } from '../../users/entities/role.entity';

// docs/04 §4.3 POST /auth/register. Requires at least one of email/phone — enforced in
// AuthService.register (class-validator can't express "at least one of" cleanly), which
// throws a 400 with a stable error code (docs/04 §4.1) if both are missing.
export class RegisterDto {
  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @MinLength(8)
  password: string;

  @IsString()
  fullName: string;

  // MVP: role is chosen at registration (docs/07 Phase 4 step 1). Teacher-category selection
  // (docs/01 §1.1) happens as a separate onboarding step once TEACHER is chosen here.
  @IsIn([RoleName.TEACHER, RoleName.STUDENT, RoleName.PARENT])
  role: RoleName;

  @IsOptional()
  @IsIn(['en', 'hi'])
  preferredLanguage?: string;

  @IsString()
  deviceId: string; // registration auto-logs-in (docs/04 §4.3), so it issues a device-bound token pair
}
