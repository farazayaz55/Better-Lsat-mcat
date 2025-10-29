import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';

import { configModuleOptions } from './configs/module-options';
import { AllExceptionsFilter } from './filters/all-exceptions.filter';
import { LoggingInterceptor } from './interceptors/logging.interceptor';
import { AppLoggerModule } from './logger/logger.module';
import { EmployeeAvailabilityService } from './slot/services/employee-availability.service';
import { GoogleCalendarModule } from './services/google-calendar/google-calendar.module';
import { FeatureFlagService } from './services/feature-flag.service';
import { FinancialNumberService } from './services/financial-number.service';
import { StripeService } from './services/stripe.service';
import { QueueModule } from './queue/queue.module';

@Module({
  imports: [
    ConfigModule.forRoot(configModuleOptions),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('database.host'),
        port: configService.get<number | undefined>('database.port'),
        database: configService.get<string>('database.name'),
        username: configService.get<string>('database.user'),
        password: configService.get<string>('database.pass'),
        // eslint-disable-next-line unicorn/prefer-module
        entities: [__dirname + '/../**/entities/*.entity{.ts,.js}'],
        // Timezone configured on the Postgres server.
        // This is used to typecast server date/time values to JavaScript Date object and vice versa.
        timezone: 'Z',
        synchronize: false,
        debug: configService.get<string>('env') === 'development',
        // Add connection retry and timeout settings
        connectTimeoutMS: 30000,
        acquireTimeoutMS: 30000,
        timeout: 30000,
        retryAttempts: 5,
        retryDelay: 3000,
        // Add connection pool settings
        extra: {
          max: 20,
          min: 5,
          acquire: 30000,
          idle: 10000,
        },
      }),
    }),
    AppLoggerModule,
    GoogleCalendarModule,
    QueueModule,
  ],
  exports: [
    AppLoggerModule,
    ConfigModule,
    EmployeeAvailabilityService,
    GoogleCalendarModule,
    FeatureFlagService,
    FinancialNumberService,
    StripeService,
    QueueModule,
  ],
  providers: [
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },

    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
    EmployeeAvailabilityService,
    FeatureFlagService,
    FinancialNumberService,
    StripeService,
  ],
})
export class SharedModule {}
