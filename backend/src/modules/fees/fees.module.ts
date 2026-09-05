import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FeeStructure } from './entities/fee-structure.entity';
import { Discount } from './entities/discount.entity';
import { Invoice } from './entities/invoice.entity';
import { InvoiceLineItem } from './entities/invoice-line-item.entity';
import { CreditNote } from './entities/credit-note.entity';
import { Payment } from './entities/payment.entity';
import { PaymentAuditLog } from './entities/payment-audit-log.entity';
import { Refund } from './entities/refund.entity';
import { StudentCreditLedgerEntry } from './entities/student-credit-ledger-entry.entity';
import { Class } from '../classes/entities/class.entity';
import { Institute } from '../institutes/entities/institute.entity';
import { Enrollment } from '../classes/entities/enrollment.entity';
import { StudentProfile } from '../students/entities/student-profile.entity';
import { StudentGuardianLink } from '../students/entities/student-guardian-link.entity';
import { StudentTeacherAssignment } from '../students/entities/student-teacher-assignment.entity';
import { AttendanceSession } from '../attendance/entities/attendance-session.entity';
import { AttendanceRecord } from '../attendance/entities/attendance-record.entity';
import { FeesService } from './fees.service';
import { FeesController } from './fees.controller';
import { TeacherProfilesModule } from '../teacher-profiles/teacher-profiles.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PAYMENT_GATEWAY_ADAPTER } from './gateway/payment-gateway.adapter';
import { MockPaymentGatewayAdapter } from './gateway/mock-payment-gateway.adapter';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      FeeStructure,
      Discount,
      Invoice,
      InvoiceLineItem,
      CreditNote,
      Payment,
      PaymentAuditLog,
      Refund,
      StudentCreditLedgerEntry,
      // Read-only cross-references — see classes.module.ts's comment for the pattern.
      Class,
      Institute,
      Enrollment,
      StudentProfile,
      StudentGuardianLink,
      StudentTeacherAssignment,
      AttendanceSession,
      AttendanceRecord,
    ]),
    TeacherProfilesModule,
    NotificationsModule,
  ],
  controllers: [FeesController],
  providers: [
    FeesService,
    // No real gateway account exists for this project — see gateway/payment-gateway.adapter.ts.
    // Swapping in a real Razorpay/Stripe adapter later is a one-line change here.
    { provide: PAYMENT_GATEWAY_ADAPTER, useClass: MockPaymentGatewayAdapter },
  ],
  exports: [FeesService],
})
export class FeesModule {}
