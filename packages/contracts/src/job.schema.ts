import { z } from "zod";
import { JobStatus, JobType } from "@repo/types";
import { stringArrayQueryParam } from "./query-helpers";
import { sanitizeFreeText } from "./sanitize.schema";

export const TechLevelEnum = z.enum(["BEGINNER", "INTERMEDIATE", "ADVANCED"]);
export type TechLevel = z.infer<typeof TechLevelEnum>;

const JobOfferBaseSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(10).max(10000).transform(sanitizeFreeText),
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

function checkSalaryRange(data: { salaryMin?: number; salaryMax?: number }) {
  return (
    data.salaryMin == null ||
    data.salaryMax == null ||
    data.salaryMin <= data.salaryMax
  );
}

const salaryRangeRefinement = {
  message: "salaryMin doit être inférieur ou égal à salaryMax",
  path: ["salaryMin"],
};

export const CreateJobOfferSchema = JobOfferBaseSchema.refine(
  checkSalaryRange,
  salaryRangeRefinement,
);

export type CreateJobOfferDto = z.infer<typeof CreateJobOfferSchema>;

// Création d'offre par un admin (back-office, CLAUDE.md §13.6) pour le compte
// d'un recruteur existant — recruiterId/companyId sont choisis explicitement
// par l'admin (pas dérivés de sa propre session), contrairement à la création
// recruteur normale.
export const AdminCreateJobOfferSchema = JobOfferBaseSchema.extend({
  recruiterId: z.string().min(1),
  companyId: z.string().min(1),
  companyName: z.string().max(200).optional(),
}).refine(checkSalaryRange, salaryRangeRefinement);

export type AdminCreateJobOfferDto = z.infer<typeof AdminCreateJobOfferSchema>;

export const UpdateJobOfferSchema = JobOfferBaseSchema.partial().refine(
  checkSalaryRange,
  salaryRangeRefinement,
);

export type UpdateJobOfferDto = z.infer<typeof UpdateJobOfferSchema>;

export const JobOfferFiltersSchema = z.object({
  type: z.nativeEnum(JobType).optional(),
  status: z.nativeEnum(JobStatus).optional(),
  technologies: stringArrayQueryParam,
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
