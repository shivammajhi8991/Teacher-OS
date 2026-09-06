import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { RefreshToken } from './entities/refresh-token.entity';
import { Guardian } from '../students/entities/guardian.entity';
import { JwtStrategy } from './strategies/jwt.strategy';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    // Guardian is a read/write cross-reference into the Students module's own entity — see
    // classes.module.ts's comment for this pattern. AuthModule doesn't import StudentsModule
    // itself (that would invert the usual dependency direction — most other modules depend on
    // Auth, not the reverse); registering just the one entity here avoids that entirely.
    TypeOrmModule.forFeature([RefreshToken, Guardian]),
    UsersModule,
    PassportModule,
    JwtModule.register({}), // secrets/expiry passed explicitly per-sign in AuthService (access vs refresh differ)
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}
