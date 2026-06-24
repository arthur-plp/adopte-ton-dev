import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { PrismaModule } from "./prisma/prisma.module";
import { PaymentModule } from "./payment/payment.module";
import { OutboxModule } from "./outbox/outbox.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    PaymentModule,
    OutboxModule,
  ],
})
export class AppModule {}
