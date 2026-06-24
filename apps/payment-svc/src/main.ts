import { NestFactory } from "@nestjs/core";
import { MicroserviceOptions, Transport } from "@nestjs/microservices";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    AppModule,
    {
      transport: Transport.TCP,
      options: {
        host: process.env["HOST"] ?? "0.0.0.0",
        port: parseInt(process.env["PORT"] ?? "3004", 10),
      },
    },
  );
  await app.listen();
}
bootstrap();
