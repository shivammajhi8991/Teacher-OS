import {
  BadRequestException,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { StudentImportService } from './student-import.service';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/request-with-user.interface';

// docs/04 §4.4 `POST /students/import`, §4.7 "returns 202 Accepted + a job id." Same
// `student.manage` permission as manual add (`POST /students`) — bulk import is the same
// capability at a different scale, not a separate grant.
@Controller()
export class StudentImportController {
  constructor(private readonly studentImportService: StudentImportService) {}

  @RequirePermission('student.manage')
  @HttpCode(HttpStatus.ACCEPTED)
  @Post('students/import')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }),
  ) // 5MB
  createImportJob(
    @UploadedFile() file: Express.Multer.File | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (!file) {
      throw new BadRequestException({
        code: 'FILE_REQUIRED',
        message: 'Attach a CSV file under the "file" field',
      });
    }
    return this.studentImportService.createImportJob(user, file.buffer);
  }

  @RequirePermission('student.manage')
  @Get('students/import-jobs/:id')
  getImportJob(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.studentImportService.getImportJob(id, user);
  }
}
