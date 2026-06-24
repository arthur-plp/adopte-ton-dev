import { Module } from "@nestjs/common";
import { ClientsModule, Transport } from "@nestjs/microservices";
import { JobOffersController } from "./job-offers.controller";
import { JobOffersService } from "./job-offers.service";

@Module({
  imports: [
    ClientsModule.register([
      {
        name: "APPLICATIONS_SVC",
        transport: Transport.TCP,
        options: {
          host: process.env["APPLICATIONS_SVC_HOST"] ?? "localhost",
          port: parseInt(process.env["APPLICATIONS_SVC_PORT"] ?? "3003", 10),
        },
      },
      {
        name: "PAYMENT_SVC",
        transport: Transport.TCP,
        options: {
          host: process.env["PAYMENT_SVC_HOST"] ?? "localhost",
          port: parseInt(process.env["PAYMENT_SVC_PORT"] ?? "3004", 10),
        },
      },
    ]),
  ],
  controllers: [JobOffersController],
  providers: [JobOffersService],
})
export class JobOffersModule {}
