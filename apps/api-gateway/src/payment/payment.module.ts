import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { PaymentController } from './payment.controller';

@Module({
  imports: [
    ClientsModule.register([
      {
        name: 'PAYMENT_SVC',
        transport: Transport.TCP,
        options: {
          host: process.env['PAYMENT_SVC_HOST'] ?? 'localhost',
          port: parseInt(process.env['PAYMENT_SVC_PORT'] ?? '3004', 10),
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
  controllers: [PaymentController],
})
export class PaymentModule {}
