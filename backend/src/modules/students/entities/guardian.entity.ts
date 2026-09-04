import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Institute } from '../../institutes/entities/institute.entity';

// docs/03 §3.4 `guardians`. `user` is nullable — most guardians are added by a teacher with just
// contact details (docs/01 §1.3: many students are minors managed entirely by a guardian who may
// never install the app); a login gets linked later if/when that guardian registers with role
// 'parent' and their phone/email is matched (docs/07 — that matching flow is a follow-up, not
// built in this pass).
@Entity('guardians')
export class Guardian {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Institute, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'institute_id' })
  institute?: Institute | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'user_id' })
  user?: User | null;

  @Column({ name: 'full_name' })
  fullName: string;

  @Column({ nullable: true })
  phone?: string;

  @Column({ nullable: true })
  email?: string;

  @Column({ nullable: true })
  relationship?: string; // free-form: 'mother', 'father', 'guardian', ...

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
