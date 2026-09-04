import { PartialType } from '@nestjs/mapped-types';
import { CreateTeacherProfileDto } from './create-teacher-profile.dto';

export class UpdateTeacherProfileDto extends PartialType(
  CreateTeacherProfileDto,
) {}
