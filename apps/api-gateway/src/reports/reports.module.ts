import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ReportsController } from './reports.controller';

@Module({
  imports: [
    ClientsModule.register([
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
  controllers: [ReportsController],
})
export class ReportsModule {}
