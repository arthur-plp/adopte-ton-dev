import { Module } from "@nestjs/common";
import { ClientsModule, Transport } from "@nestjs/microservices";
import { MatchingController } from "./matching.controller";
import { MatchingService } from "./matching.service";
import { RedisService } from "../redis/redis.service";
import { RabbitConsumerService } from "../rabbit/rabbit-consumer.service";

@Module({
  imports: [
    ClientsModule.register([
      {
        name: "AUTH_SVC",
        transport: Transport.TCP,
        options: {
          host: process.env["AUTH_SVC_HOST"] ?? "localhost",
          port: parseInt(process.env["AUTH_SVC_PORT"] ?? "3001", 10),
        },
      },
      {
        name: "JOBS_SVC",
        transport: Transport.TCP,
        options: {
          host: process.env["JOBS_SVC_HOST"] ?? "localhost",
          port: parseInt(process.env["JOBS_SVC_PORT"] ?? "3002", 10),
        },
      },
    ]),
  ],
  controllers: [MatchingController],
  providers: [MatchingService, RedisService, RabbitConsumerService],
})
export class MatchingModule {}
