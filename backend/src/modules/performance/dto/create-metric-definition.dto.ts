import { IsIn, IsOptional, IsString, IsUUID } from 'class-validator';
import { MetricType } from '../entities/performance-metric-definition.entity';

// docs/04 addition (no performance endpoints existed in the original doc — see docs/07-roadmap.md
// Phase 5 step 2 entry). `teacherCategoryId` is only meaningful for a super_admin caller,
// scope resolution and the "exactly one" rule are both enforced in PerformanceService, not here.
export class CreateMetricDefinitionDto {
  @IsString()
  name: string;

  @IsIn(Object.values(MetricType))
  metricType: MetricType;

  @IsOptional()
  @IsString()
  unit?: string;

  // super_admin only — which category this becomes a default metric for.
  @IsOptional()
  @IsUUID()
  teacherCategoryId?: string;
}
