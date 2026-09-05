import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

export enum NotificationChannel {
  PUSH = 'push',
  // Accepted per docs/03 §3.8's sketch, but not actually delivered in this pass — no mail
  // adapter exists (SMTP/SendGrid, no account either). Selecting 'email' behaves exactly like
  // 'off' today (in-app row only): a documented gap, not a silent no-op pretending to work.
  EMAIL = 'email',
  DIGEST_DAILY = 'digest_daily',
  DIGEST_WEEKLY = 'digest_weekly',
  OFF = 'off',
}

// docs/03 §3.8 `notifications`. `deliveredAt` is an addition beyond that doc's sketch (see
// docs/03's note) — digest batching needs to know "already folded into a sent digest push" vs.
// "still pending," which is a different fact from `readAt` (a push can be delivered and never
// opened, or never delivered yet and already... no, never read before delivery is possible too;
// the two timestamps are independent on purpose).
@Entity('notifications')
@Index(['user', 'createdAt'])
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column()
  type: string; // e.g. 'payment_confirmed', 'invoice_issued', 'document_shared'

  @Column()
  title: string;

  @Column('text')
  body: string;

  @Column({ type: 'jsonb', nullable: true })
  data?: Record<string, unknown> | null;

  // The channel resolved (from the user's preference, or the category default) at the moment
  // this row was created — never recomputed later, so changing a preference afterward doesn't
  // retroactively change how an already-generated notification is described.
  @Column({ name: 'delivery_channel', type: 'varchar' })
  deliveryChannel: NotificationChannel;

  @Column({ name: 'delivered_at', type: 'timestamptz', nullable: true })
  deliveredAt?: Date | null;

  @Column({ name: 'read_at', type: 'timestamptz', nullable: true })
  readAt?: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
