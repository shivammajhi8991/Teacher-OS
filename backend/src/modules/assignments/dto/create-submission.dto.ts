import { ArrayMaxSize, ArrayMinSize, IsArray, IsString } from 'class-validator';

// docs/04 §4.4 POST /assignments/:id/submissions. A submission IS its attachments — the schema
// (docs/03 §3.8) carries no separate text-note field — so at least one is required.
export class CreateSubmissionDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @IsString({ each: true })
  attachmentUrls: string[];
}
