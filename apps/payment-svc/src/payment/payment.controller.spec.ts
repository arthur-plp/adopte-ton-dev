import { Test, TestingModule } from "@nestjs/testing";
import { PaymentController } from "./payment.controller";
import { PaymentService } from "./payment.service";

const mockService = {
  getSubscription: jest.fn(),
  adminSetPlan: jest.fn(),
  createCheckoutSession: jest.fn(),
  createBillingPortalSession: jest.fn(),
  handleWebhook: jest.fn(),
};

describe("PaymentController", () => {
  let controller: PaymentController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PaymentController],
      providers: [{ provide: PaymentService, useValue: mockService }],
    }).compile();
    controller = module.get<PaymentController>(PaymentController);
    jest.clearAllMocks();
  });

  it("getSubscription délègue au service", () => {
    mockService.getSubscription.mockReturnValueOnce({ plan: "FREE" });
    const result = controller.getSubscription({ companyId: "company-1" });
    expect(mockService.getSubscription).toHaveBeenCalledWith("company-1");
    expect(result).toEqual({ plan: "FREE" });
  });

  it("adminSetPlan délègue au service", () => {
    mockService.adminSetPlan.mockReturnValueOnce({ plan: "PRO" });
    const result = controller.adminSetPlan({
      companyId: "company-1",
      plan: "PRO",
    });
    expect(mockService.adminSetPlan).toHaveBeenCalledWith("company-1", "PRO");
    expect(result).toEqual({ plan: "PRO" });
  });

  it("createCheckoutSession délègue au service", () => {
    mockService.createCheckoutSession.mockReturnValueOnce({ url: "https://x" });
    const result = controller.createCheckoutSession({
      companyId: "company-1",
      customerEmail: "r@test.com",
      successUrl: "ok",
      cancelUrl: "ko",
    });
    expect(mockService.createCheckoutSession).toHaveBeenCalledWith(
      "company-1",
      "r@test.com",
      "ok",
      "ko",
    );
    expect(result).toEqual({ url: "https://x" });
  });

  it("createBillingPortalSession délègue au service", () => {
    mockService.createBillingPortalSession.mockReturnValueOnce({
      url: "https://y",
    });
    const result = controller.createBillingPortalSession({
      companyId: "company-1",
      returnUrl: "https://app.test/dashboard",
    });
    expect(mockService.createBillingPortalSession).toHaveBeenCalledWith(
      "company-1",
      "https://app.test/dashboard",
    );
    expect(result).toEqual({ url: "https://y" });
  });

  it("handleWebhook délègue au service", () => {
    mockService.handleWebhook.mockReturnValueOnce({ received: true });
    const result = controller.handleWebhook({
      rawBody: "{}",
      signature: "sig",
    });
    expect(mockService.handleWebhook).toHaveBeenCalledWith("{}", "sig");
    expect(result).toEqual({ received: true });
  });
});
