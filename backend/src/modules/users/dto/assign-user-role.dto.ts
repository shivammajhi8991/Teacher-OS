import { IsIn, IsOptional, IsUUID } from 'class-validator';
import { RoleName } from '../entities/role.entity';

export class AssignUserRoleDto {
  @IsIn([
    RoleName.TEACHER,
    RoleName.STUDENT,
    RoleName.PARENT,
    RoleName.INSTITUTE_ADMIN,
    RoleName.SUPER_ADMIN,
  ])
  role: RoleName;

  // Required for institute_admin/teacher/student/parent roles scoped to one institute; omitted
  // for a platform-level super_admin grant or an independent (non-institute) teacher/student.
  @IsOptional()
  @IsUUID()
  instituteId?: string;
}
