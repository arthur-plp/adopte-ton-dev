import { Injectable } from "@nestjs/common";
import Stripe from "stripe";

export type CreateCheckoutSessionParams = {
  companyId: string;
  customerEmail: string;
  stripeCustomerId: string | null;
  successUrl: string;
  cancelUrl: string;
};

@Injectable()
export class StripeService {
  private readonly client: Stripe;

  constructor() {
    this.client = new Stripe(process.env["STRIPE_SECRET_KEY"] ?? "");
  }

  createCheckoutSession(params: CreateCheckoutSessionParams) {
    return this.client.checkout.sessions.create({
      mode: "subscription",
      line_items: [
        { price: process.env["STRIPE_PRICE_PRO"] ?? "", quantity: 1 },
      ],
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
      client_reference_id: params.companyId,
      subscription_data: { metadata: { companyId: params.companyId } },
      ...(params.stripeCustomerId
        ? { customer: params.stripeCustomerId }
        : { customer_email: params.customerEmail }),
    });
  }

  createBillingPortalSession(stripeCustomerId: string, returnUrl: string) {
    return this.client.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: returnUrl,
    });
  }

  constructEvent(rawBody: string, signature: string): Stripe.Event {
    return this.client.webhooks.constructEvent(
      rawBody,
      signature,
      process.env["STRIPE_WEBHOOK_SECRET"] ?? "",
    );
  }
}
