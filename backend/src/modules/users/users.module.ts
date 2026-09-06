import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { Role } from './entities/role.entity';
import { Permission } from './entities/permission.entity';
import { UserRole } from './entities/user-role.entity';
import { UsersService } from './users.service';
import { AdminUsersService } from './admin-users.service';
import { AdminUsersController } from './admin-users.controller';

@Module({
  imports: [TypeOrmModule.forFeature([User, Role, Permission, UserRole])],
  controllers: [AdminUsersController],
  providers: [UsersService, AdminUsersService],
  exports: [UsersService],
})
export class UsersModule {}
