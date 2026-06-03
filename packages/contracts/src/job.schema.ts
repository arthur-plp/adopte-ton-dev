import { z } from "zod";
import { JobStatus, JobType } from "@repo/types";

const JobOfferBaseSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(10).max(10000),
  type: z.nativeEnum(JobType),
  location: z.string().max(200).optional(),
  remoteOk: z.boolean().default(false),
  requiredTechnologies: z.array(z.string().min(1)).default([]),
  salaryMin: z.number().int().positive().optional(),
  salaryMax: z.number().int().positive().optional(),
  isPublic: z.boolean().default(true),
});

export const CreateJobOfferSchema = JobOfferBaseSchema.refine(
  (data) =>
    data.salaryMin === undefined ||
    data.salaryMax === undefined ||
    data.salaryMin <= data.salaryMax,
  { message: "salaryMin doit être inférieur ou égal à salaryMax", path: ["salaryMin"] },
);

export type CreateJobOfferDto = z.infer<typeof CreateJobOfferSchema>;

export const UpdateJobOfferSchema = JobOfferBaseSchema.partial().refine(
  (data) =>
    data.salaryMin === undefined ||
    data.salaryMax === undefined ||
    data.salaryMin <= data.salaryMax,
  { message: "salaryMin doit être inférieur ou égal à salaryMax", path: ["salaryMin"] },
);

export type UpdateJobOfferDto = z.infer<typeof UpdateJobOfferSchema>;

export const JobOfferFiltersSchema = z.object({
  type: z.nativeEnum(JobType).optional(),
  status: z.nativeEnum(JobStatus).optional(),
  technologies: z.array(z.string()).optional(),
  remoteOk: z
    .string()
    .transform((v) => v === "true")
    .optional(),
  location: z.string().optional(),
  companyId: z.string().optional(),
});

export type JobOfferFiltersDto = z.infer<typeof JobOfferFiltersSchema>;
