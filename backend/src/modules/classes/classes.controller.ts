import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ClassesService } from './classes.service';
import { CreateClassDto } from './dto/create-class.dto';
import { UpdateClassDto } from './dto/update-class.dto';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { CreateExceptionDto } from './dto/create-exception.dto';
import { EnrollStudentDto } from './dto/enroll-student.dto';
import { AddToWaitlistDto } from './dto/add-to-waitlist.dto';
import { ClassStatus } from './entities/class.entity';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/request-with-user.interface';

// docs/04 §4.4 "Classes / Batches / Schedules". `class.manage` is teacher/institute_admin/
// super_admin only (docs/06 §6.2); `class.read` is granted to every role, with resource-level
// scoping (own classes / enrolled-in classes) enforced in ClassesService.
@Controller('classes')
export class ClassesController {
  constructor(private readonly classesService: ClassesService) {}

  @RequirePermission('class.manage')
  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateClassDto) {
    return this.classesService.create(user.userId, dto);
  }

  @RequirePermission('class.read')
  @Get()
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('status') status?: ClassStatus,
  ) {
    return this.classesService.findAll(user, { status });
  }

  @RequirePermission('class.read')
  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.classesService.findById(id, user);
  }

  @RequirePermission('class.manage')
  @Patch(':id')
  update(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateClassDto,
  ) {
    return this.classesService.update(id, user, dto);
  }

  @RequirePermission('class.manage')
  @Post(':id/schedule')
  createSchedule(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateScheduleDto,
  ) {
    return this.classesService.createSchedule(id, user, dto);
  }

  @RequirePermission('class.manage')
  @Post(':id/exceptions')
  createException(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateExceptionDto,
  ) {
    return this.classesService.createException(id, user, dto);
  }

  @RequirePermission('class.manage')
  @Post(':id/enrollments')
  enrollStudent(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: EnrollStudentDto,
  ) {
    return this.classesService.enrollStudent(id, user, dto);
  }

  @RequirePermission('class.manage')
  @Post(':id/waitlist')
  addToWaitlist(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: AddToWaitlistDto,
  ) {
    return this.classesService.addToWaitlist(id, user, dto);
  }

  // Not in docs/04 §4.4's original list — see ClassesService.getEnrollments/getCurrentSchedule.
  @RequirePermission('class.read')
  @Get(':id/enrollments')
  getEnrollments(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.classesService.getEnrollments(id, user);
  }

  @RequirePermission('class.read')
  @Get(':id/schedule')
  getSchedule(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.classesService.getCurrentSchedule(id, user);
  }

  @RequirePermission('class.manage')
  @Get(':id/conflicts')
  getConflicts(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.classesService.getConflicts(id, user);
  }
}
