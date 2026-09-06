import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Institute } from './institute.entity';

// docs/03 §3.2 `branches` — coaching chains with multiple physical locations under one admin
// (docs/01 §1.3 "multi-tenant hierarchy"). `deletedAt` is an addition beyond this doc's original
// column list (Phase 5 step 4, when CRUD for this entity was first exposed) — soft-delete only,
// matching this codebase's never-hard-delete convention everywhere else.
@Entity('branches')
export class Branch {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Institute, (institute) => institute.branches, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'institute_id' })
  institute: Institute;

  @Column()
  name: string;

  @Column({ nullable: true })
  address?: string;

  @Column({ default: 'UTC' })
  timezone: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz' })
  deletedAt?: Date;
}
