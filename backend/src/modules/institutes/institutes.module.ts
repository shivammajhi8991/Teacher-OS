import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Institute } from './entities/institute.entity';
import { Branch } from './entities/branch.entity';
import { InstitutesService } from './institutes.service';
import { InstitutesController } from './institutes.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Institute, Branch])],
  controllers: [InstitutesController],
  providers: [InstitutesService],
  exports: [InstitutesService],
})
export class InstitutesModule {}
