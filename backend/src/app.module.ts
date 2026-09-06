import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
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
    // docs/04 §4.3 — global baseline; auth endpoints layer a stricter @Throttle() on top.
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
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
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard }, // protected by default, opt out with @Public()
    { provide: APP_GUARD, useClass: PermissionsGuard }, // no-op unless a route has @RequirePermission
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
  ],
})
export class AppModule {}
