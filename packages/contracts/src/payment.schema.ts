import { z } from "zod";
import { PlanType } from "@repo/types";

export const CreateSubscriptionSchema = z.object({
  companyId: z.string().min(1),
  plan: z.nativeEnum(PlanType),
});

export type CreateSubscriptionDto = z.infer<typeof CreateSubscriptionSchema>;

export const StripeWebhookSchema = z.object({
  type: z.string(),
  data: z.object({
    object: z.record(z.string(), z.unknown()),
  }),
});

export type StripeWebhookDto = z.infer<typeof StripeWebhookSchema>;
