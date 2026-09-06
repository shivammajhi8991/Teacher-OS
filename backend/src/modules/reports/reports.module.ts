import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AttendanceSession } from '../attendance/entities/attendance-session.entity';
import { AttendanceRecord } from '../attendance/entities/attendance-record.entity';
import { Class } from '../classes/entities/class.entity';
import { Invoice } from '../fees/entities/invoice.entity';
import { Payment } from '../fees/entities/payment.entity';
import { CreditNote } from '../fees/entities/credit-note.entity';
import { StudentProfile } from '../students/entities/student-profile.entity';
import { PerformanceRecord } from '../performance/entities/performance-record.entity';
import { ExportJob } from './entities/export-job.entity';
import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';
import { TeacherProfilesModule } from '../teacher-profiles/teacher-profiles.module';
import { StorageModule } from '../../common/storage/storage.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ExportJob,
      // Read-only cross-references — see classes.module.ts's comment for the pattern.
      AttendanceSession,
      AttendanceRecord,
      Class,
      Invoice,
      Payment,
      CreditNote,
      StudentProfile,
      PerformanceRecord,
    ]),
    TeacherProfilesModule,
    StorageModule,
  ],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
