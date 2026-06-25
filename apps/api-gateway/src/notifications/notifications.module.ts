import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { NotificationsController } from './notifications.controller';

@Module({
  imports: [
    ClientsModule.register([
      {
        name: 'NOTIFICATIONS_SVC',
        transport: Transport.TCP,
        options: {
          host: process.env['NOTIFICATIONS_SVC_HOST'] ?? 'localhost',
          port: parseInt(process.env['NOTIFICATIONS_SVC_PORT'] ?? '3007', 10),
        },
      },
    ]),
  ],
  controllers: [NotificationsController],
})
export class NotificationsModule {}
