import { z } from "zod";

export const ReportTargetTypeSchema = z.enum(["profile", "job"]);
export type ReportTargetType = z.infer<typeof ReportTargetTypeSchema>;

export const ReportStatusSchema = z.enum(["open", "resolved", "dismissed"]);
export type ReportStatus = z.infer<typeof ReportStatusSchema>;

export const CreateReportSchema = z.object({
  targetType: ReportTargetTypeSchema,
  targetId: z.string().min(1),
  reason: z.string().min(3).max(500),
});

export type CreateReportDto = z.infer<typeof CreateReportSchema>;

export const UpdateReportStatusSchema = z.object({
  status: ReportStatusSchema,
});

export type UpdateReportStatusDto = z.infer<typeof UpdateReportStatusSchema>;
