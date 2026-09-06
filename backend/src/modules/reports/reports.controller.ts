import {
  Controller,
  Get,
  Param,
  Post,
  Body,
  Query,
  Res,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { ReportsService } from './reports.service';
import { ReportQueryDto } from './dto/report-query.dto';
import { StudentReportQueryDto } from './dto/student-report-query.dto';
import { CreateExportJobDto } from './dto/create-export-job.dto';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/request-with-user.interface';

// docs/04 §4.4 "Reports". Every route shares one `report.generate` permission (docs/06 §6.2 has
// no separate verbs for this resource, just F/–) — resource-level scope (own/institute/platform)
// is resolved inside ReportsService, never from a client-supplied id except super_admin's
// optional `instituteId`. @Res() puts these three GET routes into library-specific response mode
// (same as NotesController.getFile) since the content-type and filename are decided per request.
@Controller()
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @RequirePermission('report.generate')
  @Get('reports/attendance')
  async getAttendanceReport(
    @Query() query: ReportQueryDto,
    @CurrentUser() user: AuthenticatedUser,
    @Res() res: Response,
  ) {
    const file = await this.reportsService.generateAttendanceReport(
      user,
      query,
    );
    this.sendFile(res, file);
  }

  @RequirePermission('report.generate')
  @Get('reports/fees')
  async getFeesReport(
    @Query() query: ReportQueryDto,
    @CurrentUser() user: AuthenticatedUser,
    @Res() res: Response,
  ) {
    const file = await this.reportsService.generateFeesReport(user, query);
    this.sendFile(res, file);
  }

  @RequirePermission('report.generate')
  @Get('reports/students/:id')
  async getStudentReport(
    @Param('id') studentId: string,
    @Query() _query: StudentReportQueryDto,
    @CurrentUser() user: AuthenticatedUser,
    @Res() res: Response,
  ) {
    const file = await this.reportsService.generateStudentReport(
      studentId,
      user,
    );
    this.sendFile(res, file);
  }

  // docs/04 §4.7 "the triggering endpoint returns 202 Accepted + a job id."
  @RequirePermission('report.generate')
  @HttpCode(HttpStatus.ACCEPTED)
  @Post('export-jobs')
  createExportJob(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateExportJobDto,
  ) {
    return this.reportsService.createExportJob(user, dto);
  }

  @RequirePermission('report.generate')
  @Get('export-jobs/:id')
  getExportJob(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.reportsService.getExportJob(id, user);
  }

  @RequirePermission('report.generate')
  @Get('export-jobs/:id/file')
  async getExportJobFile(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Res() res: Response,
  ) {
    const file = await this.reportsService.getExportJobFile(id, user);
    this.sendFile(res, file);
  }

  private sendFile(
    res: Response,
    file: { filename: string; contentType: string; buffer: Buffer },
  ): void {
    res.setHeader('Content-Type', file.contentType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${file.filename}"`,
    );
    res.send(file.buffer);
  }
}
