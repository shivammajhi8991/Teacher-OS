import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { PerformanceService } from './performance.service';
import { CreateMetricDefinitionDto } from './dto/create-metric-definition.dto';
import { CreatePerformanceRecordDto } from './dto/create-performance-record.dto';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/request-with-user.interface';

// docs/07-roadmap.md Phase 5 step 2 — no performance endpoints existed in docs/04's original
// surface; this is the documented addition. `performance.define` (create a metric definition,
// scope resolved by role in the service) and `performance.record` (record a value, teacher
// only) are separate permissions, matching docs/06 §6.2's two separate matrix rows —
// institute_admin/super_admin hold `define` but not `record`.
@Controller()
export class PerformanceController {
  constructor(private readonly performanceService: PerformanceService) {}

  @RequirePermission('performance.define')
  @Post('performance-metric-definitions')
  createMetricDefinition(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateMetricDefinitionDto,
  ) {
    return this.performanceService.createMetricDefinition(user, dto);
  }

  @RequirePermission('performance.read')
  @Get('performance-metric-definitions')
  listApplicableDefinitions(@CurrentUser() user: AuthenticatedUser) {
    return this.performanceService.listApplicableDefinitions(user);
  }

  @RequirePermission('performance.record')
  @Post('performance-records')
  recordPerformance(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreatePerformanceRecordDto,
  ) {
    return this.performanceService.recordPerformance(user, dto);
  }

  @RequirePermission('performance.read')
  @Get('students/:id/performance')
  getStudentPerformance(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.performanceService.getStudentPerformance(id, user);
  }
}
