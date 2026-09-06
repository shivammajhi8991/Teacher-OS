import { PartialType } from '@nestjs/mapped-types';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreateTeacherCategoryDto } from './create-teacher-category.dto';

export class UpdateTeacherCategoryDto extends PartialType(
  CreateTeacherCategoryDto,
) {
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
