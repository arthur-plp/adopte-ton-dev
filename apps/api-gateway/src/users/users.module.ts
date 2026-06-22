import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { UsersController } from './users.controller';

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
    ]),
  ],
  controllers: [UsersController],
})
export class UsersModule {}
