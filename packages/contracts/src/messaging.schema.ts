import { z } from "zod";

import { cuidLike } from "./id.schema";

export const CreateConversationSchema = z.object({
  recruiterId: cuidLike,
  developerId: cuidLike,
  jobOfferId: cuidLike.optional(),
});

export type CreateConversationDto = z.infer<typeof CreateConversationSchema>;

export const SendMessageSchema = z.object({
  conversationId: cuidLike,
  content: z.string().min(1).max(5000),
});

export type SendMessageDto = z.infer<typeof SendMessageSchema>;
