import { Module } from "@nestjs/common";
import { ClientsModule, Transport } from "@nestjs/microservices";
import { ApplicationsController } from "./applications.controller";
import { ApplicationsService } from "./applications.service";
import { S3Service } from "../documents/s3.service";

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
    ]),
  ],
  controllers: [ApplicationsController],
  providers: [ApplicationsService, S3Service],
})
export class ApplicationsModule {}
