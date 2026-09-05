import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Document } from './document.entity';

export enum ShareTargetType {
  STUDENT = 'student',
  CLASS = 'class',
  INSTITUTE = 'institute',
}

// docs/03 §3.8 `document_shares`. `sharedWithId` is polymorphic (a StudentProfile/Class/Institute
// id depending on `sharedWithType`) — resolved by type in NotesService, not a typed FK relation,
// the same "polymorphic reference, resolved in code" shape used nowhere else in this codebase
// yet, but the cleanest fit for "share with one of three unrelated entity types."
@Entity('document_shares')
export class DocumentShare {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Document, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'document_id' })
  document: Document;

  @Column({ name: 'shared_with_type', type: 'varchar' })
  sharedWithType: ShareTargetType;

  @Column({ name: 'shared_with_id', type: 'uuid' })
  sharedWithId: string;

  @Column({ name: 'allow_download', default: true })
  allowDownload: boolean;

  @CreateDateColumn({ name: 'shared_at', type: 'timestamptz' })
  sharedAt: Date;
}
