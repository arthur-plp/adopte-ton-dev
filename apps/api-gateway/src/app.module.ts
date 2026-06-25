import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { UsersModule } from './users/users.module';
import { JobOffersModule } from './job-offers/job-offers.module';
import { AdminModule } from './admin/admin.module';
import { ApplicationsModule } from './applications/applications.module';
import { PaymentModule } from './payment/payment.module';
import { MatchingModule } from './matching/matching.module';
import { ReportsModule } from './reports/reports.module';
import { PrivacyModule } from './privacy/privacy.module';
import { MessagingModule } from './messaging/messaging.module';
import { NotificationsModule } from './notifications/notifications.module';
import { RedisRateLimitGuard } from './rate-limit/redis-rate-limit.guard';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    UsersModule,
    JobOffersModule,
    AdminModule,
    ApplicationsModule,
    PaymentModule,
    MatchingModule,
    ReportsModule,
    PrivacyModule,
    MessagingModule,
    NotificationsModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: RedisRateLimitGuard }],
})
export class AppModule {}
