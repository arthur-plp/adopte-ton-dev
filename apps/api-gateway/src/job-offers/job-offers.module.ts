import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { JobOffersController } from './job-offers.controller';

@Module({
  imports: [
    ClientsModule.register([
      {
        name: 'JOBS_SVC',
        transport: Transport.TCP,
        options: {
          host: process.env['JOBS_SVC_HOST'] ?? 'localhost',
          port: parseInt(process.env['JOBS_SVC_PORT'] ?? '3002', 10),
        },
      },
      {
        name: 'USERS_SVC',
        transport: Transport.TCP,
        options: {
          host: process.env['AUTH_SVC_HOST'] ?? 'localhost',
          port: parseInt(process.env['AUTH_SVC_PORT'] ?? '3001', 10),
        },
      },
    ]),
  ],
  controllers: [JobOffersController],
})
export class JobOffersModule {}
