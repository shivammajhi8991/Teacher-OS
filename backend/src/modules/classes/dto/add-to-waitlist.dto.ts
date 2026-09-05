import { IsUUID } from 'class-validator';

export class AddToWaitlistDto {
  @IsUUID()
  studentId: string;
}
