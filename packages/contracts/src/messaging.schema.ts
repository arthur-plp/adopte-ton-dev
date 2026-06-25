import { z } from "zod";

import { cuidLike } from "./id.schema";
import { sanitizeFreeText } from "./sanitize.schema";

export const CreateConversationSchema = z.object({
  recruiterId: cuidLike,
  developerId: cuidLike,
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
