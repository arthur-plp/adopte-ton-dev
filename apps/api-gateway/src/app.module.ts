import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { UsersModule } from './users/users.module';
import { JobOffersModule } from './job-offers/job-offers.module';
import { AdminModule } from './admin/admin.module';
import { ApplicationsModule } from './applications/applications.module';
import { PaymentModule } from './payment/payment.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    UsersModule,
    JobOffersModule,
    AdminModule,
    ApplicationsModule,
    PaymentModule,
  ],
})
export class AppModule {}
