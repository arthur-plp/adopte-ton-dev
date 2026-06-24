import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpException,
  Inject,
  Post,
  Req,
  UseGuards,
  type RawBodyRequest,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { ApiTags, ApiOperation, ApiCookieAuth } from '@nestjs/swagger';
import { lastValueFrom } from 'rxjs';
import { AuthGuard, type AuthenticatedUser } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { OptionalAuth } from '../auth/optional-auth.decorator';
import { Role } from '@repo/types';
import {
  CreateCheckoutSessionSchema,
  CreateBillingPortalSessionSchema,
  type CreateCheckoutSessionDto,
  type CreateBillingPortalSessionDto,
} from '@repo/contracts';
import type { Request } from 'express';

type AuthRequest = Request & { user: AuthenticatedUser };

type RecruiterProfileResponse = {
  role: string;
  profile: { companyId: string } | null;
};

function toHttpException(err: unknown): never {
  if (typeof err === 'object' && err !== null) {
    const e = err as Record<string, unknown>;
    if (typeof e['statusCode'] === 'number') {
      throw new HttpException(
        String(e['message'] ?? 'Erreur'),
        e['statusCode'],
      );
    }
    if (typeof e['message'] === 'string') {
      throw new HttpException(e['message'], 500);
    }
  }
  throw new HttpException('Erreur interne', 500);
}

@ApiTags('payment')
@ApiCookieAuth('better-auth.session_token')
@Controller('payment')
@UseGuards(AuthGuard, RolesGuard)
export class PaymentController {
  constructor(
    @Inject('PAYMENT_SVC')
    private readonly paymentClient: ClientProxy,
    @Inject('USERS_SVC')
    private readonly usersClient: ClientProxy,
  ) {}

  private async send<T>(pattern: { cmd: string }, data: unknown): Promise<T> {
    try {
      return await lastValueFrom(this.paymentClient.send<T>(pattern, data));
    } catch (err: unknown) {
      toHttpException(err);
    }
  }

  // companyId n'est pas porté par la session BetterAuth : on le récupère
  // depuis le profil recruteur (même pattern que JobOffersController.create).
  private async getCompanyId(userId: string): Promise<string> {
    try {
      const data = await lastValueFrom(
        this.usersClient.send<RecruiterProfileResponse>(
          { cmd: 'users.getProfile' },
          { userId },
        ),
      );
      const companyId = data.profile?.companyId;
      if (!companyId) {
        throw new BadRequestException(
          'Aucune entreprise associée à ce compte recruteur.',
        );
      }
      return companyId;
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      toHttpException(err);
    }
  }

  private parseCreateCheckoutSession(body: unknown): CreateCheckoutSessionDto {
    const result = CreateCheckoutSessionSchema.safeParse(body);
    if (!result.success) throw new BadRequestException(result.error.flatten());
    return result.data;
  }

  private parseCreateBillingPortalSession(
    body: unknown,
  ): CreateBillingPortalSessionDto {
    const result = CreateBillingPortalSessionSchema.safeParse(body);
    if (!result.success) throw new BadRequestException(result.error.flatten());
    return result.data;
  }

  @Get('subscription')
  @Roles(Role.RECRUITER)
  @ApiOperation({ summary: "Abonnement courant de l'entreprise du recruteur" })
  async getSubscription(@Req() req: AuthRequest) {
    const companyId = await this.getCompanyId(req.user.id);
    return this.send({ cmd: 'payment.getSubscription' }, { companyId });
  }

  @Post('checkout-session')
  @Roles(Role.RECRUITER)
  @ApiOperation({
    summary: 'Créer une session de paiement Stripe (passage au plan Pro)',
  })
  async createCheckoutSession(@Req() req: AuthRequest, @Body() body: unknown) {
    const dto = this.parseCreateCheckoutSession(body);
    const companyId = await this.getCompanyId(req.user.id);
    return this.send(
      { cmd: 'payment.createCheckoutSession' },
      {
        companyId,
        customerEmail: req.user.email,
        successUrl: dto.successUrl,
        cancelUrl: dto.cancelUrl,
      },
    );
  }

  @Post('billing-portal')
  @Roles(Role.RECRUITER)
  @ApiOperation({
    summary: 'Créer une session du portail de facturation Stripe',
  })
  async createBillingPortalSession(
    @Req() req: AuthRequest,
    @Body() body: unknown,
  ) {
    const dto = this.parseCreateBillingPortalSession(body);
    const companyId = await this.getCompanyId(req.user.id);
    return this.send(
      { cmd: 'payment.createBillingPortalSession' },
      { companyId, returnUrl: dto.returnUrl },
    );
  }

  @Post('webhook')
  @OptionalAuth()
  @ApiOperation({
    summary: 'Webhook Stripe (signature vérifiée par payment-svc)',
  })
  async webhook(@Req() req: RawBodyRequest<Request>) {
    const signature = req.headers['stripe-signature'];
    if (!req.rawBody || typeof signature !== 'string') {
      throw new BadRequestException('Requête webhook invalide.');
    }
    return this.send(
      { cmd: 'payment.webhook.handle' },
      { rawBody: req.rawBody.toString('utf8'), signature },
    );
  }
}
