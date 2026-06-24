import { z } from "zod";

const SkillLevelEnum = z.enum(["BEGINNER", "INTERMEDIATE", "ADVANCED"]);

export const MatchingSearchFiltersSchema = z.object({
  technologies: z.array(z.string()).optional(),
  levels: z
    .string()
    .optional()
    .transform((value, ctx) => {
      if (!value) return undefined;
      try {
        return z.record(z.string(), SkillLevelEnum).parse(JSON.parse(value));
      } catch {
        ctx.addIssue({ code: "custom", message: "levels invalide (JSON attendu)" });
        return undefined;
      }
    }),
  remoteOk: z
    .string()
    .transform((v) => v === "true")
    .optional(),
  location: z.string().optional(),
  jobOfferId: z.string().optional(),
});

export type MatchingSearchFiltersDto = z.infer<typeof MatchingSearchFiltersSchema>;
