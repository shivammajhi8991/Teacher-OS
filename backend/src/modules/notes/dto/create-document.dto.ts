import {
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  IsUrl,
} from 'class-validator';
import { DocumentFileType } from '../entities/document.entity';

// docs/04 §4.4 POST /documents — the "confirm upload, attach metadata" step. `objectKey` (from
// POST /documents/upload-url) is required for an uploaded file; `externalUrl` is required instead
// when fileType is 'link' (spec §7 "Content can be shared with... Links") — enforced in the
// service, not here, matching the "exactly one of" pattern used elsewhere in this codebase.
export class CreateDocumentDto {
  @IsString()
  title: string;

  @IsIn([
    DocumentFileType.PDF,
    DocumentFileType.IMAGE,
    DocumentFileType.VIDEO,
    DocumentFileType.AUDIO,
    DocumentFileType.LINK,
    DocumentFileType.OTHER,
  ])
  fileType: DocumentFileType;

  @IsOptional()
  @IsUUID()
  objectKey?: string;

  @IsOptional()
  @IsUrl()
  externalUrl?: string;

  @IsOptional()
  @IsString()
  folderName?: string;

  @IsOptional()
  @IsDateString()
  expiryDate?: string;

  @IsOptional()
  @IsUUID()
  previousVersionId?: string;
}
