import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Institute } from '../../institutes/entities/institute.entity';
import { User } from '../../users/entities/user.entity';

export enum AnnouncementTargetType {
  CLASS = 'class',
  INSTITUTE = 'institute',
  // Addition beyond docs/03 §3.8's sketch (which only listed 'class'|'institute'|'individual') —
  // docs/06 §6.2 names super_admin's grant as "F (platform-wide)" but the doc's own target_type
  // enum had nowhere for that to point; PLATFORM is that missing target (target_id unused).
  PLATFORM = 'platform',
}

// docs/03 §3.8 `announcements`. `target_id` is polymorphic (a Class id for CLASS, an Institute
// id for INSTITUTE, unused for PLATFORM) — the same "polymorphic reference, resolved in code"
// shape document_shares.shared_with_id already uses in this codebase, the cleanest fit for
// "target one of a few unrelated entity types."
//
// docs/03's sketch also carried a separate `teacher_profile_id` column, dropped here in favor of
// `createdBy` (a plain User) — an institute_admin or super_admin author has no teacher_profile
// at all, so a column that's only ever populated for one of three sender types isn't earning its
// keep; `createdBy` covers every sender uniformly, and a teacher's own profile is resolvable from
// it via TeacherProfilesService when needed. docs/03's sketched `individual` target_type is
// dropped too — neither that doc nor docs/06's permission matrix ever specifies who could send
// one or why, so implementing it would mean guessing at unspecified behavior rather than a real
// requirement; CLASS/INSTITUTE/PLATFORM are exactly the three docs/06 actually describes.
@Entity('announcements')
export class Announcement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Only meaningful for an INSTITUTE-target announcement — lets an institute_admin's own
  // broadcast be found without resolving target_id first; null for CLASS/PLATFORM.
  @ManyToOne(() => Institute, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'institute_id' })
  institute?: Institute | null;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'created_by' })
  createdBy: User;

  @Column({ name: 'target_type', type: 'varchar' })
  targetType: AnnouncementTargetType;

  @Column({ name: 'target_id', type: 'uuid', nullable: true })
  targetId?: string | null;

  @Column()
  title: string;

  @Column('text')
  body: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
