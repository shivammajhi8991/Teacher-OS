import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Class } from '../../classes/entities/class.entity';
import { StudentProfile } from '../../students/entities/student-profile.entity';
import { TeacherProfile } from '../../teacher-profiles/entities/teacher-profile.entity';

// docs/03 §3.8 `assignments`. Exactly one of `class`/`student` is set — a whole-class assignment
// (every actively-enrolled student submits separately) or one targeted at a single student —
// enforced in AssignmentsService, the same "exactly one of" pattern used for Discount's
// class/student targeting and Notes' objectKey/externalUrl.
//
// `attachmentUrls` holds a mix of this app's own storage object keys (from the presigned-upload
// flow, common/storage/) and external URLs — no per-entry type discriminator exists in this
// array-of-strings shape (unlike Document, which has one `fileType` per row), so
// AssignmentsService resolves each entry by trying the storage adapter first, then falling back
// to "is this a valid http(s) URL." Either kind is genuinely fine content for an attachment.
@Entity('assignments')
export class Assignment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Class, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'class_id' })
  class?: Class | null;

  @ManyToOne(() => StudentProfile, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'student_id' })
  student?: StudentProfile | null;

  @ManyToOne(() => TeacherProfile, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'teacher_profile_id' })
  teacherProfile: TeacherProfile;

  @Column()
  title: string;

  @Column('text', { nullable: true })
  description?: string | null;

  @Column({ name: 'attachment_urls', type: 'text', array: true, default: '{}' })
  attachmentUrls: string[];

  @Column({ name: 'due_at', type: 'timestamptz' })
  dueAt: Date;

  // docs/08 §8.5 "A missed-deadline submission is visually flagged 'Late' but not blocked,
  // unless the assignment explicitly disallows late submission" — default true, matching that
  // "not blocked" is the common case.
  @Column({ name: 'allow_late_submission', default: true })
  allowLateSubmission: boolean;

  @Column({ name: 'allow_resubmission', default: false })
  allowResubmission: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz' })
  deletedAt?: Date;
}
