import { PartialType } from '@nestjs/mapped-types';
import { IsIn, IsOptional } from 'class-validator';
import { ClassStatus } from '../entities/class.entity';
import { CreateClassDto } from './create-class.dto';

// docs/04 §4.4 PATCH /classes/:id — cancellation is `status: 'cancelled'` here, never a delete
// (docs/01 §1.3 pattern, applied to classes too).
export class UpdateClassDto extends PartialType(CreateClassDto) {
  @IsOptional()
  @IsIn([ClassStatus.ACTIVE, ClassStatus.COMPLETED, ClassStatus.CANCELLED])
  status?: ClassStatus;
}
