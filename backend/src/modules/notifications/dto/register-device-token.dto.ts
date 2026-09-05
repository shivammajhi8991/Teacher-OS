import { IsIn, IsString } from 'class-validator';
import { DevicePlatform } from '../entities/device-push-token.entity';

// docs/07 roadmap addition beyond docs/04's original sketch — see device-push-token.entity.ts.
export class RegisterDeviceTokenDto {
  @IsString()
  token: string;

  @IsIn(Object.values(DevicePlatform))
  platform: DevicePlatform;
}
