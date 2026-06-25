import { z } from "zod";
import {
  Role,
  SkillLevel,
} from "@repo/types";

import { cuidLike } from "./id.schema";
import { httpUrl, sanitizeFreeText } from "./sanitize.schema";

export const CreateUserSchema = z.object({
  email: z.string().email(),
  role: z.nativeEnum(Role),
  authProvider: z.enum(["github", "google"]),
});

export type CreateUserDto = z.infer<typeof CreateUserSchema>;

export const TechnologySchema = z.object({
  name: z.string().min(1).max(100),
  level: z.nativeEnum(SkillLevel).default(SkillLevel.INTERMEDIATE),
});

export type TechnologyDto = z.infer<typeof TechnologySchema>;

export const SkillSchema = z.union([
  z.object({
    skillId: cuidLike,
    level: z.nativeEnum(SkillLevel).default(SkillLevel.INTERMEDIATE),
  }),
  z.object({
    name: z.string().min(1).max(100),
    category: z.enum(["technique", "soft"]).default("technique"),
    level: z.nativeEnum(SkillLevel).default(SkillLevel.INTERMEDIATE),
  }),
]);

export type SkillDto = z.infer<typeof SkillSchema>;

export const ProjectSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(2000).transform(sanitizeFreeText),
  repoUrl: httpUrl.optional(),
  liveUrl: httpUrl.optional(),
  technologies: z.array(z.string().min(1)).default([]),
});

export type ProjectDto = z.infer<typeof ProjectSchema>;

export const UpdateProjectSchema = ProjectSchema.partial().extend({
  visible: z.boolean().optional(),
});

export type UpdateProjectDto = z.infer<typeof UpdateProjectSchema>;

export const UpdateLevelSchema = z.object({
  level: z.nativeEnum(SkillLevel),
});

export type UpdateLevelDto = z.infer<typeof UpdateLevelSchema>;

export const CreateDeveloperProfileSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  title: z.string().max(200).optional(),
  bio: z.string().max(2000).transform(sanitizeFreeText).optional(),
  location: z.string().max(200).optional(),
  remoteOk: z.boolean().default(false),
  availability: z.string().max(200).default("Disponible immédiatement"),
  phone: z.string().max(30).optional(),
  githubUrl: httpUrl.optional(),
  portfolioUrl: httpUrl.optional(),
  linkedinUrl: httpUrl.optional(),
  // Avatar encodé en base64 (data:image/...), pas une URL http(s) — cf. UpdateRecruiterProfileSchema.avatarUrl.
  avatarUrl: z.string().max(500000).optional(),
});

export type CreateDeveloperProfileDto = z.infer<typeof CreateDeveloperProfileSchema>;

// Défini sans .default() pour que .partial() en Zod v4 retourne uniquement les champs fournis
export const UpdateDeveloperProfileSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  title: z.string().max(200),
  bio: z.string().max(2000).transform(sanitizeFreeText),
  location: z.string().max(200),
  country: z.string().max(100),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  remoteOk: z.boolean(),
  availability: z.string().max(200),
  phone: z.string().max(30),
  githubUrl: httpUrl,
  portfolioUrl: httpUrl,
  linkedinUrl: httpUrl,
  // Avatar encodé en base64 (data:image/...), pas une URL http(s) — cf. UpdateRecruiterProfileSchema.avatarUrl.
  avatarUrl: z.string().max(500000),
}).partial();

export type UpdateDeveloperProfileDto = z.infer<typeof UpdateDeveloperProfileSchema>;

export const CreateCompanySchema = z.object({
  name: z.string().min(1).max(200),
  siret: z.string().regex(/^\d{14}$/, "SIRET invalide (14 chiffres requis)").optional(),
  website: httpUrl.optional(),
  description: z.string().max(2000).transform(sanitizeFreeText).optional(),
});

export type CreateCompanyDto = z.infer<typeof CreateCompanySchema>;

export const CreateRecruiterProfileSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  companyId: cuidLike,
});

export type CreateRecruiterProfileDto = z.infer<typeof CreateRecruiterProfileSchema>;

export const UpdateRecruiterProfileSchema = z.object({
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  phone: z.string().max(30).optional(),
  avatarUrl: z.string().max(500000).optional(),
  // Company fields
  companyName: z.string().min(1).max(200).optional(),
  companySiret: z.string().regex(/^\d{14}$/, "SIRET invalide (14 chiffres requis)").optional(),
  companyWebsite: httpUrl.max(300).optional().or(z.literal("")),
  companyDescription: z.string().max(2000).transform(sanitizeFreeText).optional(),
  companyLocation: z.string().max(200).optional(),
  companySector: z.string().max(100).optional(),
  companySize: z.string().max(20).optional(),
});

export type UpdateRecruiterProfileDto = z.infer<typeof UpdateRecruiterProfileSchema>;

export const OnboardingSchema = z.discriminatedUnion("role", [
  z.object({
    role: z.literal(Role.DEVELOPER),
    profile: CreateDeveloperProfileSchema,
  }),
  z.object({
    role: z.literal(Role.RECRUITER),
    profile: CreateRecruiterProfileSchema,
    company: CreateCompanySchema.optional(),
  }),
]);

export type OnboardingDto = z.infer<typeof OnboardingSchema>;
