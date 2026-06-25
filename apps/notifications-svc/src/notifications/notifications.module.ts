import { Module } from "@nestjs/common";
import { ClientsModule, Transport } from "@nestjs/microservices";
import { NotificationsController } from "./notifications.controller";
import { NotificationsService } from "./notifications.service";
import { RabbitConsumerService } from "../rabbit/rabbit-consumer.service";

@Module({
  imports: [
    ClientsModule.register([
      {
        name: "JOBS_SVC",
        transport: Transport.TCP,
        options: {
          host: process.env["JOBS_SVC_HOST"] ?? "localhost",
          port: parseInt(process.env["JOBS_SVC_PORT"] ?? "3002", 10),
        },
      },
      {
        name: "GATEWAY_SVC",
        transport: Transport.TCP,
        options: {
          host: process.env["GATEWAY_TCP_HOST"] ?? "localhost",
          port: parseInt(process.env["GATEWAY_TCP_PORT"] ?? "4001", 10),
        },
      },
    ]),
  ],
  controllers: [NotificationsController],
  providers: [NotificationsService, RabbitConsumerService],
})
export class NotificationsModule {}
