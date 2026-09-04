import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Institute } from './institute.entity';

// docs/03 §3.2 `branches` — coaching chains with multiple physical locations under one admin
// (docs/01 §1.3 "multi-tenant hierarchy").
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
}
