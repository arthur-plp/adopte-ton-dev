import { z } from "zod";

export const CreateConversationSchema = z.object({
  recruiterId: z.string().min(1),
  developerId: z.string().min(1),
  jobOfferId: z.string().min(1).optional(),
});

export type CreateConversationDto = z.infer<typeof CreateConversationSchema>;

export const SendMessageSchema = z.object({
  conversationId: z.string().min(1),
  content: z.string().min(1).max(5000),
});

export type SendMessageDto = z.infer<typeof SendMessageSchema>;
