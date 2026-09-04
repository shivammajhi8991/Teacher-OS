import { IsString, MinLength } from 'class-validator';

// docs/04 §4.3 POST /auth/login. `identifier` is an email or phone — the service tries both
// lookups rather than forcing the client to know which one the user registered with.
export class LoginDto {
  @IsString()
  identifier: string;

  @MinLength(1)
  password: string;

  @IsString()
  deviceId: string; // ties the issued refresh token to a device (docs/02 §2.4)
}
