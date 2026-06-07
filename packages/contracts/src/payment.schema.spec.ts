import { CreateSubscriptionSchema, StripeWebhookSchema } from './payment.schema';
import { PlanType } from '@repo/types';

const validCuid = 'clxxxxxxxxxxxxxxxxxxxxxxxx';

describe('CreateSubscriptionSchema', () => {
  it('valide un abonnement FREE', () => {
    const result = CreateSubscriptionSchema.parse({ companyId: validCuid, plan: PlanType.FREE });
    expect(result.plan).toBe(PlanType.FREE);
  });

  it('valide un abonnement PRO', () => {
    const result = CreateSubscriptionSchema.parse({ companyId: validCuid, plan: PlanType.PRO });
    expect(result.plan).toBe(PlanType.PRO);
  });

  it('rejette un plan inconnu', () => {
    expect(() =>
      CreateSubscriptionSchema.parse({ companyId: validCuid, plan: 'ENTERPRISE' }),
    ).toThrow();
  });

  it('rejette un companyId non-cuid', () => {
    expect(() =>
      CreateSubscriptionSchema.parse({ companyId: 'pas-un-cuid', plan: PlanType.FREE }),
    ).toThrow();
  });
});

describe('StripeWebhookSchema', () => {
  it('valide un webhook Stripe minimal', () => {
    const result = StripeWebhookSchema.parse({
      type: 'customer.subscription.updated',
      data: { object: { id: 'sub_123', status: 'active' } },
    });
    expect(result.type).toBe('customer.subscription.updated');
  });

  it('valide un webhook avec data.object vide', () => {
    expect(() =>
      StripeWebhookSchema.parse({ type: 'payment_intent.created', data: { object: {} } }),
    ).not.toThrow();
  });

  it('rejette si le champ type est absent', () => {
    expect(() =>
      StripeWebhookSchema.parse({ data: { object: {} } }),
    ).toThrow();
  });

  it('rejette si data.object est absent', () => {
    expect(() =>
      StripeWebhookSchema.parse({ type: 'test', data: {} }),
    ).toThrow();
  });
});
