import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { AdminUsersService } from './admin-users.service';
import { SearchUsersQueryDto } from './dto/search-users-query.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { AssignUserRoleDto } from './dto/assign-user-role.dto';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/request-with-user.interface';

// docs/04 §4.4 "Admin | GET/PATCH /admin/users." Role assignment is its own `POST .../roles`
// sub-resource rather than folded into the `PATCH` (which only ever replaces `status`) — granting
// a role is additive, not a replace, the same reasoning `POST /students/:id/guardians` already
// follows for adding one guardian at a time rather than a `PATCH` that resends the whole list.
@Controller('admin/users')
export class AdminUsersController {
  constructor(private readonly adminUsersService: AdminUsersService) {}

  @RequirePermission('user.administer')
  @Get()
  search(
    @Query() query: SearchUsersQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.adminUsersService.search(user, query);
  }

  @RequirePermission('user.administer')
  @Patch(':id')
  updateStatus(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateUserStatusDto,
  ) {
    return this.adminUsersService.updateStatus(id, user, dto);
  }

  @RequirePermission('user.administer')
  @Post(':id/roles')
  assignRole(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: AssignUserRoleDto,
  ) {
    return this.adminUsersService.assignRole(id, user, dto);
  }
}
