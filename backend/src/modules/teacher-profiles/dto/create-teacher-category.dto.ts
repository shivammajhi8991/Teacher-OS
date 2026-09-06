import { IsOptional, IsString } from 'class-validator';

// docs/04 §4.4 `POST /admin/teacher-categories` "add a new category — no deploy needed" —
// docs/01 §1.1's whole point (teacher-category.entity.ts's header comment): a new category ships
// as a migration or an admin insert, never a code change. `slug` is server-generated from `name`
// (slugified, deduplicated if needed) rather than client-supplied — one less thing for the admin
// to get wrong, and this table's `slug` unique constraint is enforced either way.
export class CreateTeacherCategoryDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  icon?: string;

  @IsOptional()
  @IsString()
  defaultFeeModel?: string;
}
