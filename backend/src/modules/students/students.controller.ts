import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { StudentsService } from './students.service';
import { CreateStudentDto } from './dto/create-student.dto';
import { UpdateStudentDto } from './dto/update-student.dto';
import { GuardianInputDto } from './dto/guardian-input.dto';
import { MergeStudentsDto } from './dto/merge-students.dto';
import { CreateInviteDto } from './dto/create-invite.dto';
import { EnrollmentStatus } from './entities/student-profile.entity';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/request-with-user.interface';

// docs/04 §4.4 "Students". `student.manage` is teacher/institute_admin/super_admin only
// (docs/06 §6.2); `student.read` is granted to every role, with the actual scoping done in
// StudentsService (own students for a teacher, own child for a parent, self for a student).
@Controller('students')
export class StudentsController {
  constructor(private readonly studentsService: StudentsService) {}

  @RequirePermission('student.manage')
  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateStudentDto,
  ) {
    return this.studentsService.create(user.userId, dto);
  }

  @RequirePermission('student.manage')
  @Post('invite')
  createInvite(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateInviteDto,
  ) {
    return this.studentsService.createInvite(user, dto);
  }

  @RequirePermission('student.read')
  @Get()
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('status') status?: EnrollmentStatus,
    @Query('q') q?: string,
  ) {
    return this.studentsService.findAll(user, { status, q });
  }

  @RequirePermission('student.read')
  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.studentsService.getStudentDetail(id, user);
  }

  @RequirePermission('student.manage')
  @Patch(':id')
  update(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateStudentDto,
  ) {
    return this.studentsService.update(id, user, dto);
  }

  @RequirePermission('student.manage')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post(':id/archive')
  archive(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.studentsService.archive(id, user);
  }

  @RequirePermission('student.manage')
  @Post(':id/guardians')
  addGuardian(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: GuardianInputDto,
  ) {
    return this.studentsService.addGuardian(id, user, dto);
  }

  @RequirePermission('student.manage')
  @Post('merge')
  merge(@CurrentUser() user: AuthenticatedUser, @Body() dto: MergeStudentsDto) {
    return this.studentsService.mergeStudents(user, dto);
  }
}
