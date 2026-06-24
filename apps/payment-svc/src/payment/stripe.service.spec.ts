const mockSessionsCreate = jest.fn();
const mockPortalCreate = jest.fn();
const mockConstructEvent = jest.fn();

jest.mock("stripe", () => {
  return jest.fn().mockImplementation(() => ({
    checkout: { sessions: { create: mockSessionsCreate } },
    billingPortal: { sessions: { create: mockPortalCreate } },
    webhooks: { constructEvent: mockConstructEvent },
  }));
});

import { StripeService } from "./stripe.service";

describe("StripeService", () => {
  let service: StripeService;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env["STRIPE_PRICE_PRO"] = "price_pro_test";
    process.env["STRIPE_WEBHOOK_SECRET"] = "whsec_test";
    service = new StripeService();
  });

  describe("createCheckoutSession", () => {
    it("crée une session avec customer_email si aucun stripeCustomerId existant", async () => {
      mockSessionsCreate.mockResolvedValueOnce({
        url: "https://checkout.stripe.com/test",
      });

      const result = await service.createCheckoutSession({
        companyId: "company-1",
        customerEmail: "recruteur@test.com",
        stripeCustomerId: null,
        successUrl: "https://app.test/plans?success=true",
        cancelUrl: "https://app.test/plans?canceled=true",
      });

      expect(mockSessionsCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: "subscription",
          customer_email: "recruteur@test.com",
          client_reference_id: "company-1",
          line_items: [{ price: "price_pro_test", quantity: 1 }],
          subscription_data: { metadata: { companyId: "company-1" } },
        }),
      );
      expect(mockSessionsCreate.mock.calls[0][0]).not.toHaveProperty(
        "customer",
      );
      expect(result.url).toBe("https://checkout.stripe.com/test");
    });

    it("réutilise le stripeCustomerId existant plutôt que customer_email", async () => {
      mockSessionsCreate.mockResolvedValueOnce({
        url: "https://checkout.stripe.com/test",
      });

      await service.createCheckoutSession({
        companyId: "company-1",
        customerEmail: "recruteur@test.com",
        stripeCustomerId: "cus_existing",
        successUrl: "https://app.test/plans?success=true",
        cancelUrl: "https://app.test/plans?canceled=true",
      });

      expect(mockSessionsCreate).toHaveBeenCalledWith(
        expect.objectContaining({ customer: "cus_existing" }),
      );
      expect(mockSessionsCreate.mock.calls[0][0]).not.toHaveProperty(
        "customer_email",
      );
    });
  });

  describe("createBillingPortalSession", () => {
    it("crée une session de portail de facturation pour le customer donné", async () => {
      mockPortalCreate.mockResolvedValueOnce({
        url: "https://billing.stripe.com/test",
      });

      const result = await service.createBillingPortalSession(
        "cus_existing",
        "https://app.test/dashboard/recruiter",
      );

      expect(mockPortalCreate).toHaveBeenCalledWith({
        customer: "cus_existing",
        return_url: "https://app.test/dashboard/recruiter",
      });
      expect(result.url).toBe("https://billing.stripe.com/test");
    });
  });

  describe("constructEvent", () => {
    it("délègue la vérification de signature au SDK Stripe avec le webhook secret", () => {
      mockConstructEvent.mockReturnValueOnce({
        id: "evt_1",
        type: "checkout.session.completed",
      });

      const event = service.constructEvent("{}", "sig_test");

      expect(mockConstructEvent).toHaveBeenCalledWith(
        "{}",
        "sig_test",
        "whsec_test",
      );
      expect(event.id).toBe("evt_1");
    });
  });
});
