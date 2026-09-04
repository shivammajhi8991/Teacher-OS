import {
  CreateDateColumn,
  Entity,
  Index,
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
@Entity('user_roles')
@Index(['user', 'role', 'institute'], { unique: true })
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
