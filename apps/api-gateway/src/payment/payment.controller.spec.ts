// Mock auth.guard before imports to avoid loading better-auth (ESM-only) in Jest
jest.mock('../auth/auth.guard', () => ({
  AuthGuard: class MockAuthGuard {
    canActivate() {
      return true;
    }
  },
}));

import { Test, TestingModule } from '@nestjs/testing';
import { of, throwError } from 'rxjs';
import { BadRequestException, HttpException } from '@nestjs/common';
import { PaymentController } from './payment.controller';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Role } from '@repo/types';
import type { Request } from 'express';

type AuthenticatedUser = {
  id: string;
  email: string;
  name: string;
  image: string | null | undefined;
  role: string;
  onboarded: boolean;
  emailVerified: boolean;
  companyId?: string;
};

type AuthRequest = Request & { user: AuthenticatedUser };

const mockRecruiter: AuthenticatedUser = {
  id: 'recruiter-1',
  email: 'recruiter@test.com',
  name: 'Bob Recruteur',
  image: null,
  role: Role.RECRUITER,
  onboarded: true,
  emailVerified: true,
  companyId: 'company-1',
};

function mockReq(
  user: AuthenticatedUser,
  extra: Partial<Request> = {},
): AuthRequest {
  return { user, headers: {}, ...extra } as AuthRequest;
}

const mockPaymentClient = {
  send: jest.fn(),
};

const mockUsersClient = {
  send: jest.fn(),
};

describe('PaymentController', () => {
  let controller: PaymentController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PaymentController],
      providers: [
        { provide: 'PAYMENT_SVC', useValue: mockPaymentClient },
        { provide: 'USERS_SVC', useValue: mockUsersClient },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<PaymentController>(PaymentController);
    jest.clearAllMocks();
    mockUsersClient.send.mockReturnValue(
      of({ role: 'RECRUITER', profile: { companyId: 'company-1' } }),
    );
  });

  // ── getSubscription ──────────────────────────────────────────────────────

  describe('getSubscription', () => {
    it("retourne l'abonnement de l'entreprise du recruteur", async () => {
      mockPaymentClient.send.mockReturnValueOnce(of({ plan: 'FREE' }));
      const result = await controller.getSubscription(mockReq(mockRecruiter));
      expect(mockUsersClient.send).toHaveBeenCalledWith(
        { cmd: 'users.getProfile' },
        { userId: 'recruiter-1' },
      );
      expect(mockPaymentClient.send).toHaveBeenCalledWith(
        { cmd: 'payment.getSubscription' },
        { companyId: 'company-1' },
      );
      expect(result).toEqual({ plan: 'FREE' });
    });

    it("lance une BadRequestException si le recruteur n'a pas d'entreprise associée", async () => {
      mockUsersClient.send.mockReturnValueOnce(
        of({ role: 'RECRUITER', profile: null }),
      );
      await expect(
        controller.getSubscription(mockReq(mockRecruiter)),
      ).rejects.toThrow(BadRequestException);
      expect(mockPaymentClient.send).not.toHaveBeenCalled();
    });
  });

  // ── createCheckoutSession ────────────────────────────────────────────────

  describe('createCheckoutSession', () => {
    it('transmet la création de session de paiement à payment-svc', async () => {
      mockPaymentClient.send.mockReturnValueOnce(
        of({ url: 'https://checkout.stripe.com/x' }),
      );

      const result = await controller.createCheckoutSession(
        mockReq(mockRecruiter),
        {
          successUrl: 'https://app.test/plans?success=true',
          cancelUrl: 'https://app.test/plans?canceled=true',
        },
      );

      expect(mockPaymentClient.send).toHaveBeenCalledWith(
        { cmd: 'payment.createCheckoutSession' },
        {
          companyId: 'company-1',
          customerEmail: 'recruiter@test.com',
          successUrl: 'https://app.test/plans?success=true',
          cancelUrl: 'https://app.test/plans?canceled=true',
        },
      );
      expect(result).toEqual({ url: 'https://checkout.stripe.com/x' });
    });

    it('lance une BadRequestException si les URLs sont invalides', async () => {
      await expect(
        controller.createCheckoutSession(mockReq(mockRecruiter), {
          successUrl: 'pas-une-url',
          cancelUrl: 'pas-une-url',
        }),
      ).rejects.toThrow(BadRequestException);
      expect(mockPaymentClient.send).not.toHaveBeenCalled();
    });

    it('propage une HttpException si payment-svc échoue', async () => {
      mockPaymentClient.send.mockReturnValueOnce(
        throwError(() => ({
          statusCode: 502,
          message: "Stripe n'a pas répondu.",
        })),
      );
      await expect(
        controller.createCheckoutSession(mockReq(mockRecruiter), {
          successUrl: 'https://app.test/plans?success=true',
          cancelUrl: 'https://app.test/plans?canceled=true',
        }),
      ).rejects.toThrow(HttpException);
    });
  });

  // ── createBillingPortalSession ───────────────────────────────────────────

  describe('createBillingPortalSession', () => {
    it('transmet la création de session de portail à payment-svc', async () => {
      mockPaymentClient.send.mockReturnValueOnce(
        of({ url: 'https://billing.stripe.com/x' }),
      );

      const result = await controller.createBillingPortalSession(
        mockReq(mockRecruiter),
        {
          returnUrl: 'https://app.test/dashboard/recruiter',
        },
      );

      expect(mockPaymentClient.send).toHaveBeenCalledWith(
        { cmd: 'payment.createBillingPortalSession' },
        {
          companyId: 'company-1',
          returnUrl: 'https://app.test/dashboard/recruiter',
        },
      );
      expect(result).toEqual({ url: 'https://billing.stripe.com/x' });
    });

    it('lance une BadRequestException si returnUrl est invalide', async () => {
      await expect(
        controller.createBillingPortalSession(mockReq(mockRecruiter), {
          returnUrl: 'pas-une-url',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ── webhook ───────────────────────────────────────────────────────────────

  describe('webhook', () => {
    it('transmet le rawBody et la signature à payment-svc', async () => {
      mockPaymentClient.send.mockReturnValueOnce(of({ received: true }));

      const req = {
        headers: { 'stripe-signature': 'sig_test' },
        rawBody: Buffer.from('{"type":"checkout.session.completed"}'),
      } as unknown as Request & { rawBody: Buffer };

      const result = await controller.webhook(req);

      expect(mockPaymentClient.send).toHaveBeenCalledWith(
        { cmd: 'payment.webhook.handle' },
        {
          rawBody: '{"type":"checkout.session.completed"}',
          signature: 'sig_test',
        },
      );
      expect(result).toEqual({ received: true });
    });

    it('lance une BadRequestException si la signature est absente', async () => {
      const req = {
        headers: {},
        rawBody: Buffer.from('{}'),
      } as unknown as Request & { rawBody: Buffer };

      await expect(controller.webhook(req)).rejects.toThrow(
        BadRequestException,
      );
      expect(mockPaymentClient.send).not.toHaveBeenCalled();
    });

    it('lance une BadRequestException si le rawBody est absent', async () => {
      const req = {
        headers: { 'stripe-signature': 'sig_test' },
      } as unknown as Request & { rawBody?: Buffer };

      await expect(controller.webhook(req)).rejects.toThrow(
        BadRequestException,
      );
      expect(mockPaymentClient.send).not.toHaveBeenCalled();
    });
  });
});
