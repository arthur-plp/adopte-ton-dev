import { z } from "zod";
import { PlanType } from "@repo/types";

// Le plan n'est jamais fourni par le CLIENT (recruteur) : seule source de
// vérité pour son propre abonnement = webhooks Stripe (cf. CLAUDE.md §16).
// Ces deux premiers schémas ne valident que les URLs de redirection.
//
// AdminSetPlanSchema fait exception à ce principe : c'est un override
// administratif explicite (back-office, action ADMIN authentifiée), pas une
// donnée fournie par le recruteur concerné — cf. payment.service.ts:adminSetPlan.

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

export const AdminSetPlanSchema = z.object({
  plan: z.nativeEnum(PlanType),
});

export type AdminSetPlanDto = z.infer<typeof AdminSetPlanSchema>;
