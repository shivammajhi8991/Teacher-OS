import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import Redis from 'ioredis';
import { RedisThrottlerStorageService } from './common/throttler/redis-throttler-storage.service';
import { AuthenticatedUser } from './common/interfaces/request-with-user.interface';
import configuration, { AppConfig } from './config/configuration';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { InstitutesModule } from './modules/institutes/institutes.module';
import { TeacherProfilesModule } from './modules/teacher-profiles/teacher-profiles.module';
import { StudentsModule } from './modules/students/students.module';
import { ClassesModule } from './modules/classes/classes.module';
import { AttendanceModule } from './modules/attendance/attendance.module';
import { FeesModule } from './modules/fees/fees.module';
import { NotesModule } from './modules/notes/notes.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { AssignmentsModule } from './modules/assignments/assignments.module';
import { PerformanceModule } from './modules/performance/performance.module';
import { AnnouncementsModule } from './modules/announcements/announcements.module';
import { ReportsModule } from './modules/reports/reports.module';
import { CalendarModule } from './modules/calendar/calendar.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { PermissionsGuard } from './common/guards/permissions.guard';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService<AppConfig, true>) => ({
        type: 'postgres',
        url: configService.get('database', { infer: true }).url,
        autoLoadEntities: true,
        // NEVER true outside a throwaway local sandbox — docs/03: schema changes are migrations,
        // never silent drift. Migrations run explicitly via `npm run migration:run` (docs/07).
        synchronize: false,
        logging:
          configService.get('nodeEnv', { infer: true }) === 'development',
      }),
    }),
    // docs/04 §4.3/§4.8 — global baseline; auth and payment endpoints layer a stricter @Throttle()
    // on top. Redis-backed (Phase 6 security review — see redis-throttler-storage.service.ts for
    // why the library's own default in-memory storage never actually satisfied "via Redis sliding
    // window"), and tracked per-authenticated-user rather than per-IP wherever a user is already
    // known — see getTracker below and its provider-order note in this module's `providers`.
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService<AppConfig, true>) => ({
        throttlers: [{ ttl: 60_000, limit: 100 }],
        storage: new RedisThrottlerStorageService(
          new Redis(configService.get('redisUrl', { infer: true })),
        ),
        getTracker: (req: Record<string, unknown>) =>
          (req.user as AuthenticatedUser | undefined)?.userId ??
          (req.ip as string),
      }),
    }),
    // Registered once, here, per Nest's own recommended pattern — @Cron providers can live in
    // any module (NotificationsScheduler) and are still discovered app-wide.
    ScheduleModule.forRoot(),
    AuthModule,
    UsersModule,
    InstitutesModule,
    TeacherProfilesModule,
    StudentsModule,
    ClassesModule,
    AttendanceModule,
    FeesModule,
    NotesModule,
    NotificationsModule,
    AssignmentsModule,
    PerformanceModule,
    AnnouncementsModule,
    ReportsModule,
    CalendarModule,
  ],
  providers: [
    // Order matters: Nest runs global guards in this declared order, and the throttler's
    // getTracker (above) reads `req.user` to scope by authenticated user rather than IP — that's
    // only ever populated once JwtAuthGuard's passport strategy has run. JwtAuthGuard's own
    // `@Public()` short-circuit means req.user correctly stays undefined for the unauthenticated
    // routes (login/register) that should keep IP-based tracking instead. JwtStrategy.validate()
    // is a pure signature check (no DB round-trip), so running auth before throttling costs
    // nothing extra even on a request that's about to be rate-limited anyway.
    { provide: APP_GUARD, useClass: JwtAuthGuard }, // protected by default, opt out with @Public()
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard }, // no-op unless a route has @RequirePermission
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
  ],
})
export class AppModule {}
