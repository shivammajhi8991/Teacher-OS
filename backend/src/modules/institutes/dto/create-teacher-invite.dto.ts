import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class CreateTeacherInviteDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(90)
  expiresInDays?: number;
}
