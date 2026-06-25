import { z } from "zod";

export const UpsertJobAlertSchema = z.object({
  technologies: z.array(z.string().min(1).max(100)).max(20),
  remoteOk: z.boolean().optional(),
  location: z.string().max(200).optional(),
});

export type UpsertJobAlertDto = z.infer<typeof UpsertJobAlertSchema>;
