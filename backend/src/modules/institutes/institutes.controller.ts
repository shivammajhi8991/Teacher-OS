import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { InstitutesService } from './institutes.service';
import { CreateInstituteDto } from './dto/create-institute.dto';
import { UpdateInstituteDto } from './dto/update-institute.dto';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/request-with-user.interface';

// docs/04 §4.4 Institutes. Reads: any authenticated user (JwtAuthGuard, applied globally).
// Writes: gated by 'institute.manage' at the role level, then narrowed to "your own institute
// only" (or "super_admin only" for create) in InstitutesService — the resource-level scoping
// this controller's own comment used to flag as a follow-up, now closed.
@Controller()
export class InstitutesController {
  constructor(private readonly institutesService: InstitutesService) {}

  @RequirePermission('institute.manage')
  @Post('institutes')
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateInstituteDto,
  ) {
    return this.institutesService.create(user, dto);
  }

  @Get('institutes')
  findAll() {
    return this.institutesService.findAll();
  }

  @Get('institutes/:id')
  findOne(@Param('id') id: string) {
    return this.institutesService.findById(id);
  }

  @RequirePermission('institute.manage')
  @Patch('institutes/:id')
  update(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateInstituteDto,
  ) {
    return this.institutesService.update(id, user, dto);
  }

  @RequirePermission('institute.manage')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete('institutes/:id')
  archive(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.institutesService.archive(id, user);
  }

  @RequirePermission('branch.manage')
  @Post('institutes/:id/branches')
  createBranch(
    @Param('id') instituteId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateBranchDto,
  ) {
    return this.institutesService.createBranch(instituteId, user, dto);
  }

  @RequirePermission('branch.manage')
  @Get('institutes/:id/branches')
  listBranches(
    @Param('id') instituteId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.institutesService.listBranches(instituteId, user);
  }

  @RequirePermission('branch.manage')
  @Patch('branches/:id')
  updateBranch(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateBranchDto,
  ) {
    return this.institutesService.updateBranch(id, user, dto);
  }

  @RequirePermission('branch.manage')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete('branches/:id')
  archiveBranch(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.institutesService.archiveBranch(id, user);
  }
}
