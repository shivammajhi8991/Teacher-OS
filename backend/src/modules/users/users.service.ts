import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { Role, RoleName } from './entities/role.entity';
import { UserRole } from './entities/user-role.entity';
import { Institute } from '../institutes/entities/institute.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(Role) private readonly roleRepo: Repository<Role>,
    @InjectRepository(UserRole)
    private readonly userRoleRepo: Repository<UserRole>,
  ) {}

  findByEmailOrPhone(identifier: string): Promise<User | null> {
    return this.userRepo.findOne({
      where: [{ email: identifier }, { phone: identifier }],
    });
  }

  findById(id: string): Promise<User | null> {
    return this.userRepo.findOne({ where: { id } });
  }

  createUser(data: Partial<User>): Promise<User> {
    const user = this.userRepo.create(data);
    return this.userRepo.save(user);
  }

  async updateLastLogin(userId: string): Promise<void> {
    await this.userRepo.update(userId, { lastLoginAt: new Date() });
  }

  findRoleByName(name: RoleName): Promise<Role | null> {
    return this.roleRepo.findOne({ where: { name } });
  }

  // docs/06 §6.1 — a user can hold multiple (role, institute) pairs; this assigns one more.
  async assignRole(
    userId: string,
    roleId: string,
    instituteId: string | null,
  ): Promise<UserRole> {
    const userRole = this.userRoleRepo.create({
      user: { id: userId } as User,
      role: { id: roleId } as Role,
      institute: instituteId ? ({ id: instituteId } as Institute) : null,
    });
    return this.userRoleRepo.save(userRole);
  }

  async getUserRoles(userId: string): Promise<UserRole[]> {
    return this.userRoleRepo.find({
      where: { user: { id: userId } },
      relations: ['role', 'institute'],
    });
  }

  // docs/04 §4.5 — resolved fresh per-request (Redis-cached in production, docs/02 §2.4) rather
  // than baked into the JWT, so a permission/role change takes effect on the very next request.
  async getEffectivePermissions(
    userId: string,
    instituteId: string | null,
  ): Promise<Set<string>> {
    const userRoles = await this.userRoleRepo.find({
      where: { user: { id: userId } },
      relations: ['role', 'role.permissions', 'institute'],
    });

    const applicable = userRoles.filter(
      (ur) => !ur.institute || ur.institute.id === instituteId,
    );

    const permissions = new Set<string>();
    for (const ur of applicable) {
      for (const permission of ur.role.permissions ?? []) {
        permissions.add(permission.key);
      }
    }
    return permissions;
  }
}
