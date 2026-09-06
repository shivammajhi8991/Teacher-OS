import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TeacherCategory } from './entities/teacher-category.entity';
import { CreateTeacherCategoryDto } from './dto/create-teacher-category.dto';
import { UpdateTeacherCategoryDto } from './dto/update-teacher-category.dto';

// docs/01 §1.1 "add new categories without major code changes" — the mechanism itself
// (teacher_categories being data, not an enum) has existed since Phase 4 step 2; this is the
// admin CRUD teacher-category.entity.ts's own header comment said would ship "once [the admin
// module] exists." `teacher_category.manage` (super_admin only, docs/06 §6.2 "Teacher category
// management | – | – | – | – | F") is a new permission — institute_admin never gets a say here,
// a category is a platform-wide concept, not scoped to one institute.
@Injectable()
export class TeacherCategoryAdminService {
  constructor(
    @InjectRepository(TeacherCategory)
    private readonly categoryRepo: Repository<TeacherCategory>,
  ) {}

  async create(dto: CreateTeacherCategoryDto): Promise<TeacherCategory> {
    const slug = await this.uniqueSlugFor(dto.name);
    return this.categoryRepo.save(
      this.categoryRepo.create({
        name: dto.name,
        slug,
        icon: dto.icon,
        defaultFeeModel: dto.defaultFeeModel,
        isActive: true,
      }),
    );
  }

  async update(
    id: string,
    dto: UpdateTeacherCategoryDto,
  ): Promise<TeacherCategory> {
    const category = await this.categoryRepo.findOne({ where: { id } });
    if (!category) {
      throw new NotFoundException({
        code: 'TEACHER_CATEGORY_NOT_FOUND',
        message: `Teacher category ${id} not found`,
      });
    }
    Object.assign(category, {
      name: dto.name ?? category.name,
      icon: dto.icon ?? category.icon,
      defaultFeeModel: dto.defaultFeeModel ?? category.defaultFeeModel,
      isActive: dto.isActive ?? category.isActive,
    });
    return this.categoryRepo.save(category);
  }

  // A category is never hard-deleted (docs/01 §1.3/§1.5 — every existing teacher_profile and
  // performance_metric_definition may still reference it) — `isActive: false` via `update()` is
  // the "remove from the onboarding picker" path, matching every other soft-delete in this
  // codebase; there is no separate `archive`/delete endpoint for that reason.

  private async uniqueSlugFor(name: string): Promise<string> {
    const base = name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    let candidate = base || 'category';
    let suffix = 1;
    while (await this.categoryRepo.findOne({ where: { slug: candidate } })) {
      suffix++;
      candidate = `${base}-${suffix}`;
    }
    return candidate;
  }
}
