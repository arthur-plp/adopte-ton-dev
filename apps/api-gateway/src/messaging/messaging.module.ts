import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { MessagingController } from './messaging.controller';
import { RealtimeModule } from '../realtime/realtime.module';

@Module({
  imports: [
    RealtimeModule,
    ClientsModule.register([
      {
        name: 'MESSAGING_SVC',
        transport: Transport.TCP,
        options: {
          host: process.env['MESSAGING_SVC_HOST'] ?? 'localhost',
          port: parseInt(process.env['MESSAGING_SVC_PORT'] ?? '3006', 10),
        },
      },
      {
        name: 'USERS_SVC',
        transport: Transport.TCP,
        options: {
          host: process.env['USERS_SVC_HOST'] ?? 'localhost',
          port: parseInt(process.env['USERS_SVC_PORT'] ?? '3001', 10),
        },
      },
    ]),
  ],
  controllers: [MessagingController],
})
export class MessagingModule {}
