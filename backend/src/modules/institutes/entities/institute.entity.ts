import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Branch } from './branch.entity';

export enum InstituteStatus {
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
}

// docs/03 §3.2 `institutes`. docs/02 §2.3 — this + Branch is the multi-tenancy anchor;
// every tenant-scoped table carries an institute_id (nullable = independent teacher).
@Entity('institutes')
export class Institute {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ name: 'logo_url', nullable: true })
  logoUrl?: string;

  @Column({ nullable: true })
  address?: string;

  @Column({ name: 'contact_email', nullable: true })
  contactEmail?: string;

  @Column({ name: 'contact_phone', nullable: true })
  contactPhone?: string;

  // docs/03 §3.2 — reserved FK for docs/07 Phase 7 subscription plans; nullable until that ships.
  @Column({ name: 'subscription_plan_id', type: 'uuid', nullable: true })
  subscriptionPlanId?: string | null;

  // docs/06 §6.3 — off by default; toggling it is itself an audit-logged admin action.
  @Column({ name: 'allow_admin_attendance_override', default: false })
  allowAdminAttendanceOverride: boolean;

  @Column({ type: 'varchar', default: InstituteStatus.ACTIVE })
  status: InstituteStatus;

  @OneToMany(() => Branch, (branch) => branch.institute)
  branches: Branch[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz' })
  deletedAt?: Date;
}
