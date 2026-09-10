import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AttendanceAuditLog } from '../attendance/entities/attendance-audit-log.entity';
import { PaymentAuditLog } from '../fees/entities/payment-audit-log.entity';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

@Module({
  // Both entities are owned (written to) by Attendance/Fees respectively — re-registering them
  // here as read-only cross-references is the normal pattern this codebase already uses
  // (attendance.module.ts's own comment on re-registering Class/Institute for the same reason).
  imports: [TypeOrmModule.forFeature([AttendanceAuditLog, PaymentAuditLog])],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
