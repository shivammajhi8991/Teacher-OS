import { IsBoolean, IsEmail, IsOptional, IsString } from 'class-validator';

// Used both inline at student creation (docs/08 §8.5 — a teacher typically enters parent
// details in the same form as the student, per spec §3 "Add parent/guardian details") and
// standalone via POST /students/:id/guardians.
export class GuardianInputDto {
  @IsString()
  fullName: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  relationship?: string;

  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;

  @IsOptional()
  @IsBoolean()
  consentDataSharing?: boolean;
}
