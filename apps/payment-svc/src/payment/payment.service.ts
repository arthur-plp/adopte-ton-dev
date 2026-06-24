import { Injectable, Logger } from "@nestjs/common";
import { RpcException } from "@nestjs/microservices";
import type Stripe from "stripe";
import { Events } from "@repo/contracts";
import { PrismaService } from "../prisma/prisma.service";
import { StripeService } from "./stripe.service";

const ACTIVE_STRIPE_STATUSES = new Set(["active", "trialing"]);

function extractId(
  value: string | { id: string } | null | undefined,
): string | null {
  if (!value) return null;
  return typeof value === "string" ? value : value.id;
}

function extractCurrentPeriodEnd(
  subscription: Stripe.Subscription,
): Date | null {
  const ts = subscription.current_period_end;
  return typeof ts === "number" ? new Date(ts * 1000) : null;
}

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly stripe: StripeService,
  ) {}

  async getSubscription(companyId: string) {
    const subscription = await this.prisma.subscription.findUnique({
      where: { companyId },
    });
    if (subscription) return subscription;
    return {
      companyId,
      plan: "FREE" as const,
      status: "active",
      stripeCustomerId: null,
      stripeSubscriptionId: null,
      currentPeriodEnd: null,
    };
  }

  async createCheckoutSession(
    companyId: string,
    customerEmail: string,
    successUrl: string,
    cancelUrl: string,
  ) {
    const existing = await this.prisma.subscription.findUnique({
      where: { companyId },
    });
    const session = await this.stripe.createCheckoutSession({
      companyId,
      customerEmail,
      stripeCustomerId: existing?.stripeCustomerId ?? null,
      successUrl,
      cancelUrl,
    });
    if (!session.url)
      throw new RpcException({
        statusCode: 502,
        message: "Stripe n'a pas retourné d'URL de paiement.",
      });
    return { url: session.url };
  }

  async createBillingPortalSession(companyId: string, returnUrl: string) {
    const subscription = await this.prisma.subscription.findUnique({
      where: { companyId },
    });
    if (!subscription?.stripeCustomerId)
      throw new RpcException({
        statusCode: 400,
        message: "Aucun abonnement Stripe pour cette entreprise.",
      });
    const session = await this.stripe.createBillingPortalSession(
      subscription.stripeCustomerId,
      returnUrl,
    );
    return { url: session.url };
  }

  async handleWebhook(rawBody: string, signature: string) {
    let event: Stripe.Event;
    try {
      event = this.stripe.constructEvent(rawBody, signature);
    } catch {
      throw new RpcException({
        statusCode: 400,
        message: "Signature webhook invalide.",
      });
    }

    const already = await this.prisma.processedEvent.findUnique({
      where: { eventId: event.id },
    });
    if (already) return { received: true, duplicate: true };

    await this.processEvent(event);

    await this.prisma.processedEvent.create({ data: { eventId: event.id } });
    return { received: true };
  }

  private async processEvent(event: Stripe.Event) {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const companyId = session.client_reference_id;
        if (!companyId) {
          this.logger.warn(
            `checkout.session.completed sans client_reference_id (event ${event.id})`,
          );
          return;
        }
        await this.upsertSubscription(companyId, {
          stripeCustomerId: extractId(session.customer),
          stripeSubscriptionId: extractId(session.subscription),
          plan: "PRO",
          status: "active",
          currentPeriodEnd: null,
        });
        break;
      }
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const companyId = subscription.metadata?.["companyId"];
        if (!companyId) {
          this.logger.warn(
            `${event.type} sans metadata.companyId (event ${event.id})`,
          );
          return;
        }
        const plan = ACTIVE_STRIPE_STATUSES.has(subscription.status)
          ? "PRO"
          : "FREE";
        await this.upsertSubscription(companyId, {
          stripeCustomerId: extractId(subscription.customer),
          stripeSubscriptionId: subscription.id,
          plan,
          status: subscription.status,
          currentPeriodEnd: extractCurrentPeriodEnd(subscription),
        });
        break;
      }
      default:
        break;
    }
  }

  private async upsertSubscription(
    companyId: string,
    data: {
      stripeCustomerId: string | null;
      stripeSubscriptionId: string | null;
      plan: "FREE" | "PRO";
      status: string;
      currentPeriodEnd: Date | null;
    },
  ) {
    await this.prisma.subscription.upsert({
      where: { companyId },
      create: { companyId, ...data },
      update: data,
    });
    await this.prisma.outboxEvent.create({
      data: {
        type: Events.PAYMENT_SUBSCRIPTION_UPDATED,
        payload: { companyId, plan: data.plan, status: data.status },
      },
    });
  }
}
