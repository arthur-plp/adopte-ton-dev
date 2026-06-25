import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { PrivacyController } from './privacy.controller';

@Module({
  imports: [
    ClientsModule.register([
      {
        name: 'USERS_SVC',
        transport: Transport.TCP,
        options: {
          host: process.env['USERS_SVC_HOST'] ?? 'localhost',
          port: parseInt(process.env['USERS_SVC_PORT'] ?? '3001', 10),
        },
      },
      {
        name: 'JOBS_SVC',
        transport: Transport.TCP,
        options: {
          host: process.env['JOBS_SVC_HOST'] ?? 'localhost',
          port: parseInt(process.env['JOBS_SVC_PORT'] ?? '3002', 10),
        },
      },
      {
        name: 'APPLICATIONS_SVC',
        transport: Transport.TCP,
        options: {
          host: process.env['APPLICATIONS_SVC_HOST'] ?? 'localhost',
          port: parseInt(process.env['APPLICATIONS_SVC_PORT'] ?? '3003', 10),
        },
      },
    ]),
  ],
  controllers: [PrivacyController],
})
export class PrivacyModule {}
