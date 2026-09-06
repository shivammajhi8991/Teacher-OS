import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { UserRole } from './entities/user-role.entity';
import { RoleName } from './entities/role.entity';
import { UsersService } from './users.service';
import { SearchUsersQueryDto } from './dto/search-users-query.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { AssignUserRoleDto } from './dto/assign-user-role.dto';
import { AuthenticatedUser } from '../../common/interfaces/request-with-user.interface';

export interface AdminUserSummary {
  id: string;
  email: string | null;
  phone: string | null;
  fullName: string;
  status: string;
  roles: Array<{ role: RoleName; instituteId: string | null }>;
  createdAt: Date;
}

// docs/04 §4.4 "Admin | GET/PATCH /admin/users", docs/06 §6.2 "User/role administration | – | –
// | – | O (own institute's users) | F" — reuses the existing `user.administer` permission
// (granted to institute_admin + super_admin since Phase 4 step 1) rather than a new one; the "O"
// vs "F" distinction is resource-level scoping here, not a different permission. A separate
// service from `UsersService` (used internally by AuthService for login/permission resolution)
// so admin-only business logic — search, suspend, role grants — doesn't get mixed into that
// startup-critical path, matching Institutes' own split into institutes/teacher-invites/payouts
// services for related-but-distinct concerns.
@Injectable()
export class AdminUsersService {
  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(UserRole)
    private readonly userRoleRepo: Repository<UserRole>,
    private readonly usersService: UsersService,
  ) {}

  async search(
    requester: AuthenticatedUser,
    query: SearchUsersQueryDto,
  ): Promise<AdminUserSummary[]> {
    // Checked before touching the database at all — a resource-level check that stays correct
    // even if this method were ever called outside the normal `@RequirePermission` HTTP path,
    // and avoids building a QueryBuilder chain only to throw a moment later.
    if (
      requester.activeRole !== 'super_admin' &&
      (requester.activeRole !== 'institute_admin' || !requester.instituteId)
    ) {
      throw new ForbiddenException({
        code: 'NOT_AUTHORIZED_FOR_USER_ADMIN',
        message: 'You do not have permission to manage users',
      });
    }

    let qb = this.userRepo
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.userRoles', 'userRole')
      .leftJoinAndSelect('userRole.role', 'role')
      .leftJoinAndSelect('userRole.institute', 'institute');

    if (requester.activeRole !== 'super_admin') {
      // Scoped to users holding at least one role in the admin's own institute — an
      // institute_admin never sees the platform's full user list, only "their" people.
      qb = qb.andWhere(
        (subQb) =>
          `user.id IN ${subQb
            .subQuery()
            .select('sub_ur.user_id')
            .from(UserRole, 'sub_ur')
            .where('sub_ur.institute_id = :instituteId')
            .getQuery()}`,
        { instituteId: requester.instituteId },
      );
    }
    if (query.q) {
      qb = qb.andWhere(
        '(user.fullName ILIKE :q OR user.email ILIKE :q OR user.phone ILIKE :q)',
        { q: `%${query.q}%` },
      );
    }
    if (query.status) {
      qb = qb.andWhere('user.status = :status', { status: query.status });
    }

    const users = await qb.orderBy('user.createdAt', 'DESC').getMany();
    return users.map((u) => this.toSummary(u));
  }

  async updateStatus(
    userId: string,
    requester: AuthenticatedUser,
    dto: UpdateUserStatusDto,
  ): Promise<void> {
    await this.assertUserAccess(userId, requester);
    await this.userRepo.update(userId, { status: dto.status });
  }

  async assignRole(
    userId: string,
    requester: AuthenticatedUser,
    dto: AssignUserRoleDto,
  ): Promise<void> {
    // docs/06 §6.1 "a super_admin role is platform-level... only assignable by another super
    // admin" — an institute_admin can never grant super_admin, regardless of instituteId.
    if (
      dto.role === RoleName.SUPER_ADMIN &&
      requester.activeRole !== 'super_admin'
    ) {
      throw new ForbiddenException({
        code: 'SUPER_ADMIN_GRANT_REQUIRES_SUPER_ADMIN',
        message: 'Only a super_admin can grant the super_admin role',
      });
    }
    if (requester.activeRole !== 'super_admin') {
      if (
        requester.activeRole !== 'institute_admin' ||
        !dto.instituteId ||
        dto.instituteId !== requester.instituteId
      ) {
        throw new ForbiddenException({
          code: 'NOT_AUTHORIZED_FOR_ROLE_GRANT',
          message: 'You can only assign roles scoped to your own institute',
        });
      }
      await this.assertUserAccess(userId, requester);
    }

    const role = await this.usersService.findRoleByName(dto.role);
    if (!role) {
      throw new NotFoundException({
        code: 'ROLE_NOT_FOUND',
        message: `Role ${dto.role} not found`,
      });
    }
    try {
      await this.usersService.assignRole(
        userId,
        role.id,
        dto.instituteId ?? null,
      );
    } catch (err) {
      if ((err as { code?: string }).code === '23505') {
        throw new ConflictException({
          code: 'ROLE_ALREADY_ASSIGNED',
          message: 'This user already holds this role for this institute',
        });
      }
      throw err;
    }
  }

  private async assertUserAccess(
    userId: string,
    requester: AuthenticatedUser,
  ): Promise<void> {
    if (requester.activeRole === 'super_admin') return;
    // A missing instituteId on a non-super_admin caller must fail closed (reject), never fail
    // open — an `undefined` value in a TypeORM `where` clause is simply omitted from the query,
    // which would otherwise match ANY institute instead of none.
    if (!requester.instituteId) {
      throw new ForbiddenException({
        code: 'NOT_AUTHORIZED_FOR_USER',
        message: 'This user is not part of your institute',
      });
    }
    const existingRole = await this.userRoleRepo.findOne({
      where: { user: { id: userId }, institute: { id: requester.instituteId } },
    });
    if (!existingRole) {
      throw new ForbiddenException({
        code: 'NOT_AUTHORIZED_FOR_USER',
        message: 'This user is not part of your institute',
      });
    }
  }

  private toSummary(user: User): AdminUserSummary {
    return {
      id: user.id,
      email: user.email ?? null,
      phone: user.phone ?? null,
      fullName: user.fullName,
      status: user.status,
      roles: (user.userRoles ?? []).map((ur) => ({
        role: ur.role.name,
        instituteId: ur.institute?.id ?? null,
      })),
      createdAt: user.createdAt,
    };
  }
}
