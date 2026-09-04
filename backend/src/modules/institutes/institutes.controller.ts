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
import { RequirePermission } from '../../common/decorators/require-permission.decorator';

// docs/04 §4.4 Institutes. Reads: any authenticated user (JwtAuthGuard, applied globally).
// Writes: gated by 'institute.manage' (docs/06 §6.2 — institute_admin/super_admin only).
// NOTE: this is role-level only — resource-level scoping ("only YOUR institute") is a Phase 4
// follow-up once teacher_profiles/institute membership resolution lands; flagged, not silently
// skipped, so it isn't mistaken for done.
@Controller('institutes')
export class InstitutesController {
  constructor(private readonly institutesService: InstitutesService) {}

  @RequirePermission('institute.manage')
  @Post()
  create(@Body() dto: CreateInstituteDto) {
    return this.institutesService.create(dto);
  }

  @Get()
  findAll() {
    return this.institutesService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.institutesService.findById(id);
  }

  @RequirePermission('institute.manage')
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateInstituteDto) {
    return this.institutesService.update(id, dto);
  }

  @RequirePermission('institute.manage')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id')
  archive(@Param('id') id: string) {
    return this.institutesService.archive(id);
  }
}
