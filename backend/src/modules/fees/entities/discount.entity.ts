import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { StudentProfile } from '../../students/entities/student-profile.entity';
import { Class } from '../../classes/entities/class.entity';
import { User } from '../../users/entities/user.entity';

export enum DiscountType {
  FLAT = 'flat',
  PERCENT = 'percent',
}

// docs/03 §3.7 `discounts` — scholarships/concessions, applied at invoice-generation time
// (InvoicesService.generateForClass) to whichever student/class it targets.
@Entity('discounts')
export class Discount {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => StudentProfile, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'student_id' })
  student?: StudentProfile | null;

  @ManyToOne(() => Class, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'class_id' })
  class?: Class | null;

  @Column({ type: 'varchar' })
  type: DiscountType;

  @Column({ type: 'numeric', precision: 12, scale: 2 })
  value: string;

  @Column({ nullable: true })
  reason?: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'approved_by' })
  approvedBy: User;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
