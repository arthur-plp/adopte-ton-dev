import { Module } from "@nestjs/common";
import { PaymentController } from "./payment.controller";
import { PaymentService } from "./payment.service";
import { StripeService } from "./stripe.service";

@Module({
  controllers: [PaymentController],
  providers: [PaymentService, StripeService],
})
export class PaymentModule {}
