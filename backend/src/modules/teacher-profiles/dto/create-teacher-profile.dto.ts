import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { TeachingMode } from '../entities/teacher-profile.entity';
import { SubjectOrSkillDto } from './subject-or-skill.dto';

// docs/08 §8.5 "Teacher onboarding" — category grid, then a progressive form (Basics / Teaching
// details / Fees & availability). This one DTO covers Basics + Teaching details; fee defaults
// stay off this DTO until the fees module (docs/07 Phase 4 step 6) defines fee_structures.
export class CreateTeacherProfileDto {
  @IsUUID()
  teacherCategoryId: string;

  @IsOptional()
  @IsString()
  headline?: string;

  @IsOptional()
  @IsString()
  bio?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  experienceYears?: number;

  @IsOptional()
  @IsString()
  serviceArea?: string;

  @IsIn([TeachingMode.ONLINE, TeachingMode.OFFLINE, TeachingMode.BOTH])
  teachingMode: TeachingMode;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SubjectOrSkillDto)
  subjectsOrSkills?: SubjectOrSkillDto[];

  @IsOptional()
  @IsInt()
  @Min(1)
  classDurationMinutesDefault?: number;
}
