import { IsString, MinLength } from 'class-validator';

// Phase 6 — docs/01 §1.3 "data export / account deletion request flow... absence of this is a
// compliance gap, not a nice-to-have" (and a real App Store/Play Store submission requirement —
// see docs/07 Phase 6). Requires the caller's current password as a re-authentication step before
// a destructive, hard-to-undo action — a session token alone (which could be sitting unattended
// on an unlocked device) isn't enough confirmation for this one.
export class DeleteAccountDto {
  @IsString()
  @MinLength(1)
  password: string;
}
