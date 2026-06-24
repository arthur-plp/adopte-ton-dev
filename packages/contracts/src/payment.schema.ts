import { z } from "zod";

// Le plan n'est jamais fourni par le client : seule source de vérité = webhooks
// Stripe (cf. CLAUDE.md §16). Ces schémas ne valident que les URLs de redirection.

export const CreateCheckoutSessionSchema = z.object({
  successUrl: z.string().url(),
  cancelUrl: z.string().url(),
});

export type CreateCheckoutSessionDto = z.infer<typeof CreateCheckoutSessionSchema>;

export const CreateBillingPortalSessionSchema = z.object({
  returnUrl: z.string().url(),
});

export type CreateBillingPortalSessionDto = z.infer<
  typeof CreateBillingPortalSessionSchema
>;
