import { z } from "zod";

import { cuidLike } from "./id.schema";
import { sanitizeFreeText } from "./sanitize.schema";

// recruiterId/developerId référencent l'id BetterAuth de l'utilisateur (pas
// un cuid Prisma — format propre à BetterAuth), donc une simple chaîne non
// vide ; jobOfferId est un vrai cuid Prisma émis par jobs-svc.
export const CreateConversationSchema = z.object({
  recruiterId: z.string().min(1),
  developerId: z.string().min(1),
  jobOfferId: cuidLike.optional(),
});

export type CreateConversationDto = z.infer<typeof CreateConversationSchema>;

export const SendMessageSchema = z.object({
  conversationId: cuidLike,
  content: z.string().min(1).max(5000).transform(sanitizeFreeText),
});

export type SendMessageDto = z.infer<typeof SendMessageSchema>;

// Corps de POST /messaging/conversations/:id/messages — le conversationId
// vient du paramètre d'URL, pas du body.
export const SendMessageBodySchema = z.object({
  content: z.string().min(1).max(5000).transform(sanitizeFreeText),
});

export type SendMessageBodyDto = z.infer<typeof SendMessageBodySchema>;
