import { z } from "zod";
import { ApplicationStatus } from "@repo/types";

import { cuidLike } from "./id.schema";

export const CreateApplicationSchema = z.object({
  jobOfferId: cuidLike,
  coverLetter: z.string().max(5000).optional(),
});

export type CreateApplicationDto = z.infer<typeof CreateApplicationSchema>;

export const UpdateApplicationStatusSchema = z.object({
  status: z.nativeEnum(ApplicationStatus),
  note: z.string().max(1000).optional(),
});

export type UpdateApplicationStatusDto = z.infer<typeof UpdateApplicationStatusSchema>;

export const ApplicationFiltersSchema = z.object({
  status: z.nativeEnum(ApplicationStatus).optional(),
  jobOfferId: z.string().optional(),
  developerId: z.string().optional(),
});

export type ApplicationFiltersDto = z.infer<typeof ApplicationFiltersSchema>;
