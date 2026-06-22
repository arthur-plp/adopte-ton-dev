import { z } from "zod";
import { JobStatus, JobType } from "@repo/types";

export const TechLevelEnum = z.enum(["BEGINNER", "INTERMEDIATE", "ADVANCED"]);
export type TechLevel = z.infer<typeof TechLevelEnum>;

const JobOfferBaseSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(10).max(10000),
  type: z.nativeEnum(JobType),
  location: z.string().max(200).optional(),
  country: z.string().max(100).optional(),
  remoteOk: z.boolean().default(false),
  requiredTechnologies: z.array(z.string().min(1)).default([]),
  requiredTechLevels: z.record(z.string(), TechLevelEnum).optional(),
  salaryMin: z.number().int().min(0).optional(),
  salaryMax: z.number().int().min(0).optional(),
  isPublic: z.boolean().default(true),
});

export const CreateJobOfferSchema = JobOfferBaseSchema.refine(
  (data) =>
    data.salaryMin == null ||
    data.salaryMax == null ||
    data.salaryMin <= data.salaryMax,
  { message: "salaryMin doit être inférieur ou égal à salaryMax", path: ["salaryMin"] },
);

export type CreateJobOfferDto = z.infer<typeof CreateJobOfferSchema>;

export const UpdateJobOfferSchema = JobOfferBaseSchema.partial().refine(
  (data) =>
    data.salaryMin == null ||
    data.salaryMax == null ||
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

export const JobOfferResponseSchema = z.object({
  id: z.string(),
  companyId: z.string(),
  companyName: z.string().nullish(),
  recruiterId: z.string(),
  title: z.string(),
  description: z.string(),
  type: z.nativeEnum(JobType),
  status: z.nativeEnum(JobStatus),
  isPublic: z.boolean(),
  location: z.string().nullish(),
  country: z.string().nullish(),
  remoteOk: z.boolean(),
  requiredTechnologies: z.array(z.string()),
  requiredTechLevels: z.record(z.string(), TechLevelEnum).nullable(),
  salaryMin: z.number().nullable(),
  salaryMax: z.number().nullable(),
  rejectionReason: z.string().nullish(),
  createdAt: z.coerce.date(),
  publishedAt: z.coerce.date().nullable(),
  updatedAt: z.coerce.date(),
});

export type JobOfferResponseDto = z.infer<typeof JobOfferResponseSchema>;

export const PaginatedJobOffersSchema = z.object({
  data: z.array(JobOfferResponseSchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
});
