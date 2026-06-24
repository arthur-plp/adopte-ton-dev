import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ApplicationsController } from './applications.controller';

@Module({
  imports: [
    ClientsModule.register([
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
  controllers: [ApplicationsController],
})
export class ApplicationsModule {}
