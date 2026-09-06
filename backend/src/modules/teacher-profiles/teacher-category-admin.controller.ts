import { Body, Controller, Param, Patch, Post } from '@nestjs/common';
import { TeacherCategoryAdminService } from './teacher-category-admin.service';
import { CreateTeacherCategoryDto } from './dto/create-teacher-category.dto';
import { UpdateTeacherCategoryDto } from './dto/update-teacher-category.dto';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';

// docs/04 §4.4 "Admin (separate guard, super_admin only)" — `GET /teacher-categories` (public,
// every role, drives onboarding) stays on `TeacherProfilesController`; only add/edit is
// admin-gated, so it lives on its own controller rather than mixing an admin-only route into a
// `@Public()` one.
@Controller()
export class TeacherCategoryAdminController {
  constructor(
    private readonly categoryAdminService: TeacherCategoryAdminService,
  ) {}

  @RequirePermission('teacher_category.manage')
  @Post('teacher-categories')
  create(@Body() dto: CreateTeacherCategoryDto) {
    return this.categoryAdminService.create(dto);
  }

  @RequirePermission('teacher_category.manage')
  @Patch('teacher-categories/:id')
  update(@Param('id') id: string, @Body() dto: UpdateTeacherCategoryDto) {
    return this.categoryAdminService.update(id, dto);
  }
}
