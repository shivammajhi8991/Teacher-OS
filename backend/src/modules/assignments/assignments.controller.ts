import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AssignmentsService } from './assignments.service';
import { CreateAssignmentDto } from './dto/create-assignment.dto';
import { CreateSubmissionDto } from './dto/create-submission.dto';
import { ReviewSubmissionDto } from './dto/review-submission.dto';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/request-with-user.interface';

// docs/04 §4.4 "Notes / Assignments" (assignments half). `assignment.manage` covers create/
// review (teacher-only, per docs/06 §6.2); `assignment.read` covers list/get/attachments for
// both teacher and student (each scoped to their own relevant assignments in the service);
// `assignment.submit` covers a student's own submission.
@Controller()
export class AssignmentsController {
  constructor(private readonly assignmentsService: AssignmentsService) {}

  @RequirePermission('assignment.manage')
  @Post('assignments/upload-url')
  createUploadUrl() {
    return this.assignmentsService.createUploadUrl();
  }

  // Raw binary body — see main.ts's `express.raw()` registration for this exact path and
  // common/storage/local-disk-storage.adapter.ts for what "uploadUrl" actually points to here.
  // Mirrors notes.controller.ts's identical upload-bytes route for the same reasons.
  @RequirePermission('assignment.manage')
  @Post('assignments/storage/upload/:objectKey')
  async uploadBytes(
    @Param('objectKey') objectKey: string,
    @Req() req: Request,
  ) {
    await this.assignmentsService.writeUploadedBytes(
      objectKey,
      req.body as Buffer,
    );
    return { objectKey };
  }

  @RequirePermission('assignment.manage')
  @Post('assignments')
  createAssignment(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateAssignmentDto,
  ) {
    return this.assignmentsService.createAssignment(user, dto);
  }

  @RequirePermission('assignment.read')
  @Get('assignments')
  listAssignments(
    @CurrentUser() user: AuthenticatedUser,
    @Query('classId') classId?: string,
    @Query('studentId') studentId?: string,
  ) {
    return this.assignmentsService.listAssignments(user, {
      classId,
      studentId,
    });
  }

  @RequirePermission('assignment.read')
  @Get('assignments/:id')
  getAssignment(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.assignmentsService.getAssignment(id, user);
  }

  // @Res() puts Nest into library-specific response mode — see notes.controller.ts's identical
  // getFile route for why @Header() wouldn't work here.
  @RequirePermission('assignment.read')
  @Get('assignments/:id/attachments/:objectKey')
  async getAssignmentAttachment(
    @Param('id') id: string,
    @Param('objectKey') objectKey: string,
    @CurrentUser() user: AuthenticatedUser,
    @Res() res: Response,
  ) {
    const content = await this.assignmentsService.getAssignmentAttachment(
      id,
      objectKey,
      user,
    );
    if (content.kind === 'redirect') {
      res.redirect(content.redirectUrl!);
      return;
    }
    res.setHeader('Content-Type', 'application/octet-stream');
    res.send(content.buffer);
  }

  @RequirePermission('assignment.submit')
  @Post('assignments/:id/submissions')
  createSubmission(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateSubmissionDto,
  ) {
    return this.assignmentsService.createSubmission(id, user, dto);
  }

  @RequirePermission('assignment.read')
  @Get('assignments/:id/submissions')
  listSubmissions(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.assignmentsService.listSubmissions(id, user);
  }

  @RequirePermission('assignment.read')
  @Get('assignment-submissions/:id/attachments/:objectKey')
  async getSubmissionAttachment(
    @Param('id') id: string,
    @Param('objectKey') objectKey: string,
    @CurrentUser() user: AuthenticatedUser,
    @Res() res: Response,
  ) {
    const content = await this.assignmentsService.getSubmissionAttachment(
      id,
      objectKey,
      user,
    );
    if (content.kind === 'redirect') {
      res.redirect(content.redirectUrl!);
      return;
    }
    res.setHeader('Content-Type', 'application/octet-stream');
    res.send(content.buffer);
  }

  @RequirePermission('assignment.manage')
  @Patch('assignment-submissions/:id/review')
  reviewSubmission(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ReviewSubmissionDto,
  ) {
    return this.assignmentsService.reviewSubmission(id, user, dto);
  }
}
