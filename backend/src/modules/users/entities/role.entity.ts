import {
  Column,
  Entity,
  JoinTable,
  ManyToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Permission } from './permission.entity';

// docs/03 §3.2 `roles` — the fixed platform role set. Adding a role is a migration (rare, deliberate);
// adding a *permission* to an existing role is a data change via admin (docs/04 admin endpoints).
export enum RoleName {
  TEACHER = 'teacher',
  STUDENT = 'student',
  PARENT = 'parent',
  INSTITUTE_ADMIN = 'institute_admin',
  SUPER_ADMIN = 'super_admin',
}

@Entity('roles')
export class Role {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', unique: true })
  name: RoleName;

  @ManyToMany(() => Permission, (permission) => permission.roles)
  @JoinTable({
    name: 'role_permissions',
    joinColumn: { name: 'role_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'permission_id', referencedColumnName: 'id' },
  })
  permissions: Permission[];
}
