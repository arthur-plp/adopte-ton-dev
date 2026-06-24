import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { MatchingController } from './matching.controller';

@Module({
  imports: [
    ClientsModule.register([
      {
        name: 'MATCHING_SVC',
        transport: Transport.TCP,
        options: {
          host: process.env['MATCHING_SVC_HOST'] ?? 'localhost',
          port: parseInt(process.env['MATCHING_SVC_PORT'] ?? '3005', 10),
        },
      },
    ]),
  ],
  controllers: [MatchingController],
})
export class MatchingModule {}
