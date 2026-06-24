import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';
import { DeveloperProfilesModule } from './developer-profiles/developer-profiles.module';
import { RecruiterProfilesModule } from './recruiter-profiles/recruiter-profiles.module';
import { OutboxModule } from './outbox/outbox.module';
import { ReportsModule } from './reports/reports.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    UsersModule,
    DeveloperProfilesModule,
    RecruiterProfilesModule,
    OutboxModule,
    ReportsModule,
  ],
})
export class AppModule {}
