import { Column, Entity, ManyToMany, PrimaryGeneratedColumn } from 'typeorm';
import { Role } from './role.entity';

// docs/03 §3.2 `permissions` — fine-grained 'resource.action' strings, e.g. 'attendance.mark'.
// Seeded via migration (see database/migrations), not created through the API.
@Entity('permissions')
export class Permission {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  key: string; // e.g. 'attendance.mark' — see docs/06-roles-permissions.md for the full catalogue

  @Column({ nullable: true })
  description?: string;

  @ManyToMany(() => Role, (role) => role.permissions)
  roles: Role[];
}
