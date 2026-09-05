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
import { Institute } from '../../institutes/entities/institute.entity';
import { User } from '../../users/entities/user.entity';

export enum DocumentFileType {
  PDF = 'pdf',
  IMAGE = 'image',
  VIDEO = 'video',
  AUDIO = 'audio',
  LINK = 'link',
  OTHER = 'other',
}

// docs/03 §3.8 `documents`. `folderName` is a plain string tag rather than the doc sketch's
// `folder_id` (a full folders table with hierarchy) — spec §7's "Categories/folders" reads as a
// light organizational aid, not nested folders, so a string is the honest amount of structure for
// this pass; promoting it to a real Folder entity later is additive; `fileUrl` holds either an
// external link (fileType='link') or this app's own storage object key (see storage/), resolved
// through StorageAdapter, never used directly as a client-facing path.
@Entity('documents')
export class Document {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Institute, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'institute_id' })
  institute?: Institute | null;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'uploaded_by' })
  uploadedBy: User;

  @Column()
  title: string;

  @Column({ name: 'file_url' })
  fileUrl: string; // external URL (fileType='link') or an internal storage object key

  @Column({ name: 'file_type', type: 'varchar' })
  fileType: DocumentFileType;

  @Column({ name: 'folder_name', nullable: true })
  folderName?: string;

  @Column({ name: 'expiry_date', type: 'timestamptz', nullable: true })
  expiryDate?: Date | null;

  @Column({ default: 1 })
  version: number;

  @ManyToOne(() => Document, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'previous_version_id' })
  previousVersion?: Document | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz' })
  deletedAt?: Date;
}
