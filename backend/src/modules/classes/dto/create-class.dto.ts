import { IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { ClassMode, ClassType } from '../entities/class.entity';

// docs/04 §4.4 POST /classes.
export class CreateClassDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  subjectOrActivity?: string;

  @IsOptional()
  @IsIn([ClassType.RECURRING, ClassType.ONE_TIME, ClassType.TRIAL])
  classType?: ClassType;

  @IsIn([ClassMode.ONLINE, ClassMode.OFFLINE])
  mode: ClassMode;

  @IsOptional()
  @IsString()
  locationOrMeetingLink?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  capacityMax?: number;

  @IsString()
  startDate: string; // ISO date

  @IsOptional()
  @IsString()
  endDate?: string;
}
