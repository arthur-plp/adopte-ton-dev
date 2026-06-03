import { z } from "zod";

export const CreateConversationSchema = z.object({
  recruiterId: z.string().cuid(),
  developerId: z.string().cuid(),
  jobOfferId: z.string().cuid().optional(),
});

export type CreateConversationDto = z.infer<typeof CreateConversationSchema>;

export const SendMessageSchema = z.object({
  conversationId: z.string().cuid(),
  content: z.string().min(1).max(5000),
});

export type SendMessageDto = z.infer<typeof SendMessageSchema>;
