import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { StudentProfile } from './student-profile.entity';
import { TeacherProfile } from '../../teacher-profiles/entities/teacher-profile.entity';

// docs/03 §3.4 `student_teacher_assignments` — the ONLY place "who manages this student" is
// expressed (docs/01 §1.3 "a student having multiple teachers"). Row-level access control for
// the whole students module is built on querying this table, not a column on student_profiles.
@Entity('student_teacher_assignments')
export class StudentTeacherAssignment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => StudentProfile, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'student_id' })
  student: StudentProfile;

  @ManyToOne(() => TeacherProfile, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'teacher_profile_id' })
  teacherProfile: TeacherProfile;

  @Column({ name: 'subject_or_skill', nullable: true })
  subjectOrSkill?: string;

  @Column({ name: 'assigned_from', type: 'timestamptz' })
  assignedFrom: Date;

  // null = ongoing/current assignment; set when a teacher stops managing this student (docs/01
  // §1.3 "student changes batch"/"leaving temporarily" resolve at the enrollment/class level once
  // classes exist — this column is the teacher-level equivalent, available now).
  @Column({ name: 'assigned_to', type: 'timestamptz', nullable: true })
  assignedTo?: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
