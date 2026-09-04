import { IsOptional, IsString } from 'class-validator';

export class SubjectOrSkillDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  level?: string;
}
