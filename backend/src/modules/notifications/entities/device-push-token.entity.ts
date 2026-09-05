import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

export enum DevicePlatform {
  IOS = 'ios',
  ANDROID = 'android',
  WEB = 'web',
}

// Addition beyond docs/03 §3.8's sketch (see docs/03's note) — the doc named `notifications` and
// `notification_preferences` but nothing to actually hold a device's FCM registration token,
// which real push delivery needs to exist somewhere. `token` is globally unique rather than
// scoped per-user: a real FCM token belongs to one app install at a time, so re-registering the
// same token under a different user (shared device, factory reset + re-login under a new
// account) reassigns ownership — see NotificationsService.registerDeviceToken.
@Entity('device_push_tokens')
@Unique(['token'])
export class DevicePushToken {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column()
  token: string;

  @Column({ type: 'varchar' })
  platform: DevicePlatform;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'last_seen_at', type: 'timestamptz' })
  lastSeenAt: Date;
}
