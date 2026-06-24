import { z } from "zod";
import { ApplicationStatus, InterviewMode } from "@repo/types";

import { cuidLike } from "./id.schema";

export const CreateApplicationSchema = z.object({
  jobOfferId: cuidLike,
  coverLetter: z.string().max(5000).optional(),
});

export type CreateApplicationDto = z.infer<typeof CreateApplicationSchema>;

export const UpdateApplicationStatusSchema = z.object({
  status: z.nativeEnum(ApplicationStatus),
  note: z.string().max(1000).optional(),
  interviewMode: z.nativeEnum(InterviewMode).optional(),
  interviewLocation: z.string().max(500).optional(),
});

export type UpdateApplicationStatusDto = z.infer<typeof UpdateApplicationStatusSchema>;

export const ApplicationFiltersSchema = z.object({
  status: z.nativeEnum(ApplicationStatus).optional(),
  jobOfferId: z.string().optional(),
  developerId: z.string().optional(),
});

export type ApplicationFiltersDto = z.infer<typeof ApplicationFiltersSchema>;

// ─── Pièces justificatives ─────────────────────────────────────────────────

export const CreateDocumentRequestSchema = z.object({
  label: z.string().min(1).max(100),
  note: z.string().max(500).optional(),
});

export type CreateDocumentRequestDto = z.infer<typeof CreateDocumentRequestSchema>;

// Plafond appliqué à la fois côté Zod (rejet avant appel S3) et dans la
// condition `content-length-range` de l'URL presignée (rejet par S3 lui-même,
// donc impossible à contourner même en appelant l'API directement).
export const MAX_DOCUMENT_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 Mo

// Restreint aux formats attendus pour un CV/pièce d'identité/diplôme — empêche
// le dépôt de types arbitraires (ex. text/html) qui pourraient être ouverts en
// inline par un navigateur et exécutés (XSS stocké via fichier déguisé).
export const ALLOWED_DOCUMENT_CONTENT_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
] as const;

export const CreateUploadUrlSchema = z.object({
  fileName: z.string().min(1).max(255),
  contentType: z.enum(ALLOWED_DOCUMENT_CONTENT_TYPES),
  fileSize: z
    .number()
    .int()
    .positive()
    .max(MAX_DOCUMENT_FILE_SIZE_BYTES),
});

export type CreateUploadUrlDto = z.infer<typeof CreateUploadUrlSchema>;

export const ConfirmUploadSchema = z.object({
  fileKey: z.string().min(1),
  fileName: z.string().min(1).max(255),
});

export type ConfirmUploadDto = z.infer<typeof ConfirmUploadSchema>;
