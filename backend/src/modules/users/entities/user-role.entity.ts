import {
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from './user.entity';
import { Role } from './role.entity';
import { Institute } from '../../institutes/entities/institute.entity';

// docs/03 §3.2 `user_roles` — a user can hold MULTIPLE (role, institute) pairs at once
// (docs/06 §6.1: an institute owner who also teaches holds both institute_admin and teacher).
// institute_id null = platform-level (super_admin) or an independent teacher/student/parent
// not tied to any institute.
//
// Uniqueness is NOT a single `@Index(['user','role','institute'], {unique:true})` — the original
// one (Phase 4 step 1) silently never blocked a duplicate null-`institute` grant, since standard
// SQL treats NULL as distinct from NULL in a unique constraint. Real raw-SQL migrations are
// authoritative here (`synchronize: false`, project-wide), and the actual schema (see
// `1772843200000-UserRolesNullInstituteUniqueness.ts`) is two partial unique indexes instead:
// one for institute-scoped grants, one specifically for null-institute grants — this decorator
// is deliberately omitted rather than left showing a shape the database doesn't actually enforce.
@Entity('user_roles')
export class UserRole {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, (user) => user.userRoles, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => Role, { eager: true })
  @JoinColumn({ name: 'role_id' })
  role: Role;

  @ManyToOne(() => Institute, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'institute_id' })
  institute?: Institute | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
