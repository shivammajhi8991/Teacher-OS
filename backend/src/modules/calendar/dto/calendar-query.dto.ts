import { IsIn, IsOptional, IsString, IsUUID } from 'class-validator';

// docs/04 §4.4 `GET /calendar?from=&to=&ownerType=&ownerId=`. `ownerType`/`ownerId` are both
// optional — omitted, they mean "my own calendar" (resolved server-side per role: a teacher's
// own classes, a student's own enrolled classes, a parent's linked children's, an
// institute_admin's own institute, platform-wide for super_admin), the same "own scope, never
// client-supplied for the common case" pattern reports/report-query.dto.ts already establishes.
// Only 'class' and 'institute' are accepted as an EXPLICIT other-owner lookup this pass (a real,
// bounded use case each: "this class's calendar" from a Class Detail screen, "this institute's
// calendar" for an admin) — 'teacher'/'student' as an explicit ownerType naming someone other
// than the caller is a documented scope cut, not part of docs/06's actual granted use cases.
export class CalendarQueryDto {
  @IsString()
  from: string; // ISO date

  @IsString()
  to: string; // ISO date

  @IsOptional()
  @IsIn(['class', 'institute'])
  ownerType?: 'class' | 'institute';

  @IsOptional()
  @IsUUID()
  ownerId?: string;
}
