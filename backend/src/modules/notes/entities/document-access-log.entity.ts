import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Document } from './document.entity';
import { User } from '../../users/entities/user.entity';

// docs/03 §3.8 `document_access_log` — spec §7 "file access tracking where possible." Every
// successful GET .../file logs one row here; the view-vs-download distinction the doc sketch
// allows for isn't meaningful for this pass's serving model (there's no separate "preview"
// endpoint), so every access logs as 'download'.
export enum DocumentAccessAction {
  VIEW = 'view',
  DOWNLOAD = 'download',
}

@Entity('document_access_log')
export class DocumentAccessLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Document, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'document_id' })
  document: Document;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'accessed_by' })
  accessedBy: User;

  @CreateDateColumn({ name: 'accessed_at', type: 'timestamptz' })
  accessedAt: Date;

  @Column({ type: 'varchar' })
  action: DocumentAccessAction;
}
