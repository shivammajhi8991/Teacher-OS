import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { NotificationChannel } from './notification.entity';

// docs/03 §3.8 `notification_preferences`. `category` is a small, fixed, code-controlled enum
// (see notifications.constants.ts) rather than an admin-extensible lookup table like
// teacher_categories — the set of event categories this app raises is a code change (adding a
// new notify() call site), not something an institute admin configures.
@Entity('notification_preferences')
@Index(['user', 'category'], { unique: true })
export class NotificationPreference {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column()
  category: string;

  @Column({ type: 'varchar' })
  channel: NotificationChannel;
}
