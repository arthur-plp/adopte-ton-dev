import { Controller } from "@nestjs/common";
import { MessagePattern, Payload } from "@nestjs/microservices";
import { PaymentService } from "./payment.service";

@Controller()
export class PaymentController {
  constructor(private readonly service: PaymentService) {}

  @MessagePattern({ cmd: "payment.getSubscription" })
  getSubscription(@Payload() data: { companyId: string }) {
    return this.service.getSubscription(data.companyId);
  }

  @MessagePattern({ cmd: "payment.createCheckoutSession" })
  createCheckoutSession(
    @Payload()
    data: {
      companyId: string;
      customerEmail: string;
      successUrl: string;
      cancelUrl: string;
    },
  ) {
    return this.service.createCheckoutSession(
      data.companyId,
      data.customerEmail,
      data.successUrl,
      data.cancelUrl,
    );
  }

  @MessagePattern({ cmd: "payment.createBillingPortalSession" })
  createBillingPortalSession(
    @Payload() data: { companyId: string; returnUrl: string },
  ) {
    return this.service.createBillingPortalSession(
      data.companyId,
      data.returnUrl,
    );
  }

  @MessagePattern({ cmd: "payment.webhook.handle" })
  handleWebhook(@Payload() data: { rawBody: string; signature: string }) {
    return this.service.handleWebhook(data.rawBody, data.signature);
  }
}
