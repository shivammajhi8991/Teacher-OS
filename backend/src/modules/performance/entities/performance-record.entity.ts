import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { PerformanceMetricDefinition } from './performance-metric-definition.entity';
import { StudentProfile } from '../../students/entities/student-profile.entity';
import { Class } from '../../classes/entities/class.entity';
import { User } from '../../users/entities/user.entity';

// docs/03 §3.8 `performance_records`. `value` is a plain string regardless of the definition's
// `metricType` — PerformanceService validates its shape against that type at write time
// (a numeric string for numeric/percentage, "1".."5" for scale_1_5, "pass"/"fail", or free text)
// rather than the schema enforcing it, the same "flexible column, service-validated" choice
// AssignmentSubmission.grade makes for the same underlying reason (no fixed shape fits every
// metric type a teacher category might define).
@Entity('performance_records')
@Index(['student', 'metricDefinition'])
export class PerformanceRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => StudentProfile, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'student_id' })
  student: StudentProfile;

  @ManyToOne(() => PerformanceMetricDefinition, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'metric_definition_id' })
  metricDefinition: PerformanceMetricDefinition;

  @ManyToOne(() => Class, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'class_id' })
  class?: Class | null;

  @Column()
  value: string;

  @Column({ name: 'recorded_at', type: 'timestamptz' })
  recordedAt: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'recorded_by' })
  recordedBy: User;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
