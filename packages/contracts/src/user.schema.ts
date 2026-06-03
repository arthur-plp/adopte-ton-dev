import { z } from "zod";
import {
  Availability,
  Role,
  SkillLevel,
} from "@repo/types";

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

export const SkillSchema = z.object({
  skillId: z.string().cuid(),
  level: z.nativeEnum(SkillLevel).default(SkillLevel.INTERMEDIATE),
});

export type SkillDto = z.infer<typeof SkillSchema>;

export const ProjectSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(2000),
  repoUrl: z.string().url().optional(),
  liveUrl: z.string().url().optional(),
  technologies: z.array(z.string().min(1)).default([]),
});

export type ProjectDto = z.infer<typeof ProjectSchema>;

export const CreateDeveloperProfileSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  title: z.string().max(200).optional(),
  bio: z.string().max(2000).optional(),
  location: z.string().max(200).optional(),
  remoteOk: z.boolean().default(false),
  availability: z.nativeEnum(Availability).default(Availability.IMMEDIATE),
  githubUrl: z.string().url().optional(),
  portfolioUrl: z.string().url().optional(),
  linkedinUrl: z.string().url().optional(),
});

export type CreateDeveloperProfileDto = z.infer<typeof CreateDeveloperProfileSchema>;

export const UpdateDeveloperProfileSchema = CreateDeveloperProfileSchema.partial();

export type UpdateDeveloperProfileDto = z.infer<typeof UpdateDeveloperProfileSchema>;

export const CreateCompanySchema = z.object({
  name: z.string().min(1).max(200),
  website: z.string().url().optional(),
  description: z.string().max(2000).optional(),
});

export type CreateCompanyDto = z.infer<typeof CreateCompanySchema>;

export const CreateRecruiterProfileSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  companyId: z.string().cuid(),
});

export type CreateRecruiterProfileDto = z.infer<typeof CreateRecruiterProfileSchema>;

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
