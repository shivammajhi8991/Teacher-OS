import { IsBoolean, IsIn, IsOptional, IsUUID } from 'class-validator';
import { ShareTargetType } from '../entities/document-share.entity';

export class CreateDocumentShareDto {
  @IsIn([
    ShareTargetType.STUDENT,
    ShareTargetType.CLASS,
    ShareTargetType.INSTITUTE,
  ])
  sharedWithType: ShareTargetType;

  @IsUUID()
  sharedWithId: string;

  @IsOptional()
  @IsBoolean()
  allowDownload?: boolean;
}
