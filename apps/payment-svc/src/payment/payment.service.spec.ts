import { Test, TestingModule } from "@nestjs/testing";
import { RpcException } from "@nestjs/microservices";
import { PaymentService } from "./payment.service";
import { PrismaService } from "../prisma/prisma.service";
import { StripeService } from "./stripe.service";

const mockPrisma = {
  subscription: {
    findUnique: jest.fn(),
    upsert: jest.fn(),
  },
  processedEvent: {
    findUnique: jest.fn(),
    create: jest.fn(),
  },
  outboxEvent: { create: jest.fn() },
};

const mockStripeService = {
  createCheckoutSession: jest.fn(),
  createBillingPortalSession: jest.fn(),
  constructEvent: jest.fn(),
};

const baseSubscription = {
  id: "sub-1",
  companyId: "company-1",
  stripeCustomerId: "cus_1",
  stripeSubscriptionId: "sub_1",
  plan: "PRO",
  status: "active",
  currentPeriodEnd: new Date("2026-08-01"),
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("PaymentService", () => {
  let service: PaymentService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: StripeService, useValue: mockStripeService },
      ],
    }).compile();
    service = module.get<PaymentService>(PaymentService);
    jest.clearAllMocks();
  });

  // ── getSubscription ─────────────────────────────────────────────────────

  describe("getSubscription", () => {
    it("retourne l'abonnement existant", async () => {
      mockPrisma.subscription.findUnique.mockResolvedValueOnce(
        baseSubscription,
      );
      const result = await service.getSubscription("company-1");
      expect(result).toEqual(baseSubscription);
    });

    it("retourne un plan FREE par défaut si aucun abonnement n'existe", async () => {
      mockPrisma.subscription.findUnique.mockResolvedValueOnce(null);
      const result = await service.getSubscription("company-1");
      expect(result.plan).toBe("FREE");
      expect(result.companyId).toBe("company-1");
    });
  });

  // ── adminSetPlan ─────────────────────────────────────────────────────────

  describe("adminSetPlan", () => {
    it("upsert le plan sans toucher aux identifiants Stripe existants", async () => {
      mockPrisma.subscription.upsert.mockResolvedValueOnce(undefined);
      mockPrisma.subscription.findUnique.mockResolvedValueOnce({
        ...baseSubscription,
        plan: "PRO",
      });
      const result = await service.adminSetPlan("company-1", "PRO");
      expect(mockPrisma.subscription.upsert).toHaveBeenCalledWith({
        where: { companyId: "company-1" },
        create: { companyId: "company-1", plan: "PRO", status: "active" },
        update: { plan: "PRO", status: "active" },
      });
      expect(result.plan).toBe("PRO");
    });

    it("émet un événement payment.subscription.updated", async () => {
      mockPrisma.subscription.upsert.mockResolvedValueOnce(undefined);
      mockPrisma.subscription.findUnique.mockResolvedValueOnce(null);
      await service.adminSetPlan("company-1", "FREE");
      expect(mockPrisma.outboxEvent.create).toHaveBeenCalledWith({
        data: {
          type: expect.stringContaining("subscription"),
          payload: { companyId: "company-1", plan: "FREE", status: "active" },
        },
      });
    });
  });

  // ── createCheckoutSession ────────────────────────────────────────────────

  describe("createCheckoutSession", () => {
    it("crée une session de paiement sans stripeCustomerId si pas d'abonnement existant", async () => {
      mockPrisma.subscription.findUnique.mockResolvedValueOnce(null);
      mockStripeService.createCheckoutSession.mockResolvedValueOnce({
        url: "https://checkout.stripe.com/x",
      });

      const result = await service.createCheckoutSession(
        "company-1",
        "recruteur@test.com",
        "https://app.test/plans?success=true",
        "https://app.test/plans?canceled=true",
      );

      expect(mockStripeService.createCheckoutSession).toHaveBeenCalledWith({
        companyId: "company-1",
        customerEmail: "recruteur@test.com",
        stripeCustomerId: null,
        successUrl: "https://app.test/plans?success=true",
        cancelUrl: "https://app.test/plans?canceled=true",
      });
      expect(result.url).toBe("https://checkout.stripe.com/x");
    });

    it("réutilise le stripeCustomerId d'un abonnement déjà existant (ex. ancien Pro résilié)", async () => {
      mockPrisma.subscription.findUnique.mockResolvedValueOnce({
        ...baseSubscription,
        plan: "FREE",
      });
      mockStripeService.createCheckoutSession.mockResolvedValueOnce({
        url: "https://checkout.stripe.com/x",
      });

      await service.createCheckoutSession(
        "company-1",
        "recruteur@test.com",
        "https://app.test/plans?success=true",
        "https://app.test/plans?canceled=true",
      );

      expect(mockStripeService.createCheckoutSession).toHaveBeenCalledWith(
        expect.objectContaining({ stripeCustomerId: "cus_1" }),
      );
    });

    it("lance une RpcException 502 si Stripe ne retourne pas d'URL", async () => {
      mockPrisma.subscription.findUnique.mockResolvedValueOnce(null);
      mockStripeService.createCheckoutSession.mockResolvedValueOnce({
        url: null,
      });

      await expect(
        service.createCheckoutSession(
          "company-1",
          "recruteur@test.com",
          "ok",
          "ko",
        ),
      ).rejects.toThrow(RpcException);
    });
  });

  // ── createBillingPortalSession ───────────────────────────────────────────

  describe("createBillingPortalSession", () => {
    it("crée une session de portail si un stripeCustomerId existe", async () => {
      mockPrisma.subscription.findUnique.mockResolvedValueOnce(
        baseSubscription,
      );
      mockStripeService.createBillingPortalSession.mockResolvedValueOnce({
        url: "https://billing.stripe.com/x",
      });

      const result = await service.createBillingPortalSession(
        "company-1",
        "https://app.test/dashboard",
      );

      expect(mockStripeService.createBillingPortalSession).toHaveBeenCalledWith(
        "cus_1",
        "https://app.test/dashboard",
      );
      expect(result.url).toBe("https://billing.stripe.com/x");
    });

    it("lance une RpcException 400 si l'entreprise n'a jamais payé", async () => {
      mockPrisma.subscription.findUnique.mockResolvedValueOnce(null);
      await expect(
        service.createBillingPortalSession(
          "company-1",
          "https://app.test/dashboard",
        ),
      ).rejects.toThrow(RpcException);
    });
  });

  // ── handleWebhook ─────────────────────────────────────────────────────────

  describe("handleWebhook", () => {
    it("lance une RpcException 400 si la signature est invalide", async () => {
      mockStripeService.constructEvent.mockImplementationOnce(() => {
        throw new Error("invalid signature");
      });
      await expect(service.handleWebhook("{}", "bad-sig")).rejects.toThrow(
        RpcException,
      );
      expect(mockPrisma.processedEvent.findUnique).not.toHaveBeenCalled();
    });

    it("ignore un événement déjà traité (idempotence)", async () => {
      mockStripeService.constructEvent.mockReturnValueOnce({
        id: "evt_1",
        type: "checkout.session.completed",
      });
      mockPrisma.processedEvent.findUnique.mockResolvedValueOnce({
        id: "p1",
        eventId: "evt_1",
      });

      const result = await service.handleWebhook("{}", "sig");

      expect(result).toEqual({ received: true, duplicate: true });
      expect(mockPrisma.subscription.upsert).not.toHaveBeenCalled();
    });

    it("passe l'entreprise en PRO sur checkout.session.completed", async () => {
      mockStripeService.constructEvent.mockReturnValueOnce({
        id: "evt_2",
        type: "checkout.session.completed",
        data: {
          object: {
            client_reference_id: "company-1",
            customer: "cus_1",
            subscription: "sub_1",
          },
        },
      });
      mockPrisma.processedEvent.findUnique.mockResolvedValueOnce(null);
      mockPrisma.subscription.upsert.mockResolvedValueOnce(baseSubscription);

      await service.handleWebhook("{}", "sig");

      expect(mockPrisma.subscription.upsert).toHaveBeenCalledWith({
        where: { companyId: "company-1" },
        create: expect.objectContaining({
          companyId: "company-1",
          stripeCustomerId: "cus_1",
          stripeSubscriptionId: "sub_1",
          plan: "PRO",
          status: "active",
        }),
        update: expect.objectContaining({
          stripeCustomerId: "cus_1",
          stripeSubscriptionId: "sub_1",
          plan: "PRO",
          status: "active",
        }),
      });
      expect(mockPrisma.outboxEvent.create).toHaveBeenCalledWith({
        data: {
          type: "payment.subscription.updated",
          payload: { companyId: "company-1", plan: "PRO", status: "active" },
        },
      });
      expect(mockPrisma.processedEvent.create).toHaveBeenCalledWith({
        data: { eventId: "evt_2" },
      });
    });

    it("ne fait rien si checkout.session.completed n'a pas de client_reference_id", async () => {
      mockStripeService.constructEvent.mockReturnValueOnce({
        id: "evt_3",
        type: "checkout.session.completed",
        data: { object: { client_reference_id: null } },
      });
      mockPrisma.processedEvent.findUnique.mockResolvedValueOnce(null);

      await service.handleWebhook("{}", "sig");

      expect(mockPrisma.subscription.upsert).not.toHaveBeenCalled();
      expect(mockPrisma.processedEvent.create).toHaveBeenCalledWith({
        data: { eventId: "evt_3" },
      });
    });

    it.each([
      ["active", "PRO"],
      ["trialing", "PRO"],
      ["past_due", "FREE"],
      ["canceled", "FREE"],
      ["unpaid", "FREE"],
    ])(
      "mappe le statut Stripe %s vers le plan %s sur customer.subscription.updated",
      async (stripeStatus, expectedPlan) => {
        mockStripeService.constructEvent.mockReturnValueOnce({
          id: "evt_4",
          type: "customer.subscription.updated",
          data: {
            object: {
              id: "sub_1",
              customer: "cus_1",
              status: stripeStatus,
              metadata: { companyId: "company-1" },
              current_period_end: 1785628800,
            },
          },
        });
        mockPrisma.processedEvent.findUnique.mockResolvedValueOnce(null);
        mockPrisma.subscription.upsert.mockResolvedValueOnce(baseSubscription);

        await service.handleWebhook("{}", "sig");

        expect(mockPrisma.subscription.upsert).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { companyId: "company-1" },
            create: expect.objectContaining({
              plan: expectedPlan,
              status: stripeStatus,
            }),
            update: expect.objectContaining({
              plan: expectedPlan,
              status: stripeStatus,
            }),
          }),
        );
      },
    );

    it("repasse l'entreprise en FREE sur customer.subscription.deleted", async () => {
      mockStripeService.constructEvent.mockReturnValueOnce({
        id: "evt_5",
        type: "customer.subscription.deleted",
        data: {
          object: {
            id: "sub_1",
            customer: "cus_1",
            status: "canceled",
            metadata: { companyId: "company-1" },
          },
        },
      });
      mockPrisma.processedEvent.findUnique.mockResolvedValueOnce(null);
      mockPrisma.subscription.upsert.mockResolvedValueOnce(baseSubscription);

      await service.handleWebhook("{}", "sig");

      expect(mockPrisma.subscription.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ plan: "FREE", status: "canceled" }),
        }),
      );
    });

    it("ignore les types d'événements non gérés", async () => {
      mockStripeService.constructEvent.mockReturnValueOnce({
        id: "evt_6",
        type: "invoice.paid",
      });
      mockPrisma.processedEvent.findUnique.mockResolvedValueOnce(null);

      const result = await service.handleWebhook("{}", "sig");

      expect(result).toEqual({ received: true });
      expect(mockPrisma.subscription.upsert).not.toHaveBeenCalled();
      expect(mockPrisma.processedEvent.create).toHaveBeenCalledWith({
        data: { eventId: "evt_6" },
      });
    });
  });
});
