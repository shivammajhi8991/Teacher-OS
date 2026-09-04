import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { GuardianInputDto } from './guardian-input.dto';

// docs/04 §4.4 POST /students ("manual add"). `guardians` is an optional convenience — the same
// data is reachable one-by-one via POST /students/:id/guardians afterward.
export class CreateStudentDto {
  @IsString()
  fullName: string;

  @IsOptional()
  @IsDateString()
  dob?: string;

  @IsOptional()
  @IsString()
  gender?: string;

  @IsOptional()
  @IsString()
  avatarUrl?: string;

  @IsOptional()
  @IsString()
  emergencyContactName?: string;

  @IsOptional()
  @IsString()
  emergencyContactPhone?: string;

  @IsOptional()
  @IsString()
  medicalNotes?: string;

  @IsOptional()
  @IsDateString()
  joinDate?: string; // defaults to today, service-side, if omitted

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GuardianInputDto)
  guardians?: GuardianInputDto[];
}
