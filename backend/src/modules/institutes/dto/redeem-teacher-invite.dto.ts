import { IsString } from 'class-validator';

export class RedeemTeacherInviteDto {
  @IsString()
  code: string;
}
