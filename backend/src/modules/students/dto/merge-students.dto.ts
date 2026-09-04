import { IsString, IsUUID } from 'class-validator';

export class MergeStudentsDto {
  @IsUUID()
  survivingStudentId: string;

  @IsUUID()
  mergedStudentId: string;

  @IsString()
  reason: string;
}
