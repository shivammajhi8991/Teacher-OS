import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Institute } from './entities/institute.entity';
import { Branch } from './entities/branch.entity';
import { TeacherInstituteInvite } from './entities/teacher-institute-invite.entity';
import { InstituteTeacherPayout } from './entities/institute-teacher-payout.entity';
import { TeacherProfile } from '../teacher-profiles/entities/teacher-profile.entity';
import { Invoice } from '../fees/entities/invoice.entity';
import { Payment } from '../fees/entities/payment.entity';
import { InstitutesService } from './institutes.service';
import { InstitutesController } from './institutes.controller';
import { TeacherInvitesService } from './teacher-invites.service';
import { TeacherInvitesController } from './teacher-invites.controller';
import { PayoutsService } from './payouts.service';
import { PayoutsController } from './payouts.controller';
import { TeacherProfilesModule } from '../teacher-profiles/teacher-profiles.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Institute,
      Branch,
      TeacherInstituteInvite,
      InstituteTeacherPayout,
      // Read-only cross-references — see classes.module.ts's comment for the pattern.
      TeacherProfile,
      Invoice,
      Payment,
    ]),
    TeacherProfilesModule,
  ],
  controllers: [
    InstitutesController,
    TeacherInvitesController,
    PayoutsController,
  ],
  providers: [InstitutesService, TeacherInvitesService, PayoutsService],
  exports: [InstitutesService],
})
export class InstitutesModule {}
