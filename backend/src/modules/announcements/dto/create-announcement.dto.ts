import { IsIn, IsOptional, IsString, IsUUID } from 'class-validator';
import { AnnouncementTargetType } from '../entities/announcement.entity';

// docs/04 §4.4 POST /announcements. `targetId` is required for CLASS (the classId) and ignored
// for PLATFORM; for INSTITUTE it's optional (defaults to the caller's own institute — the only
// one an institute_admin could legitimately target anyway).
export class CreateAnnouncementDto {
  @IsIn(Object.values(AnnouncementTargetType))
  targetType: AnnouncementTargetType;

  @IsOptional()
  @IsUUID()
  targetId?: string;

  @IsString()
  title: string;

  @IsString()
  body: string;
}
