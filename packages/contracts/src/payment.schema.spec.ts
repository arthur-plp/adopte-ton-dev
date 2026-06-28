import {
  CreateCheckoutSessionSchema,
  CreateBillingPortalSessionSchema,
  AdminSetPlanSchema,
} from './payment.schema';

describe('CreateCheckoutSessionSchema', () => {
  it('valide des URLs de succès/annulation valides', () => {
    const result = CreateCheckoutSessionSchema.parse({
      successUrl: 'https://app.test/plans?success=true',
      cancelUrl: 'https://app.test/plans?canceled=true',
    });
    expect(result.successUrl).toBe('https://app.test/plans?success=true');
  });

  it('rejette une successUrl invalide', () => {
    expect(() =>
      CreateCheckoutSessionSchema.parse({
        successUrl: 'pas-une-url',
        cancelUrl: 'https://app.test/plans?canceled=true',
      }),
    ).toThrow();
  });

  it('rejette une cancelUrl absente', () => {
    expect(() =>
      CreateCheckoutSessionSchema.parse({
        successUrl: 'https://app.test/plans?success=true',
      }),
    ).toThrow();
  });
});

describe('CreateBillingPortalSessionSchema', () => {
  it('valide une returnUrl valide', () => {
    const result = CreateBillingPortalSessionSchema.parse({
      returnUrl: 'https://app.test/dashboard/recruiter',
    });
    expect(result.returnUrl).toBe('https://app.test/dashboard/recruiter');
  });

  it('rejette une returnUrl invalide', () => {
    expect(() =>
      CreateBillingPortalSessionSchema.parse({ returnUrl: 'pas-une-url' }),
    ).toThrow();
  });
});

describe('AdminSetPlanSchema', () => {
  it('valide FREE et PRO', () => {
    expect(AdminSetPlanSchema.parse({ plan: 'FREE' }).plan).toBe('FREE');
    expect(AdminSetPlanSchema.parse({ plan: 'PRO' }).plan).toBe('PRO');
  });

  it('rejette une valeur de plan invalide', () => {
    expect(() => AdminSetPlanSchema.parse({ plan: 'GOLD' })).toThrow();
  });
});
