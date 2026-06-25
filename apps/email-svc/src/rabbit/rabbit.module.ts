import { Module } from "@nestjs/common";
import { ClientsModule, Transport } from "@nestjs/microservices";
import { RabbitConsumerService } from "./rabbit-consumer.service";
import { MailerModule } from "../mailer/mailer.module";

@Module({
  imports: [
    MailerModule,
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
  providers: [RabbitConsumerService],
})
export class RabbitModule {}
