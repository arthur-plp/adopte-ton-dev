import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { Events } from "@repo/contracts/events";

const PAGE_SIZE = 50;

@Injectable()
export class MessagingService {
  constructor(private readonly prisma: PrismaService) {}

  private async requireParticipant(conversationId: string, userId: string) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
    });
    if (!conversation) throw new NotFoundException("Conversation introuvable");
    if (
      conversation.developerId !== userId &&
      conversation.recruiterId !== userId
    ) {
      throw new ForbiddenException();
    }
    return conversation;
  }

  private otherParticipant(
    conversation: { developerId: string; recruiterId: string },
    userId: string,
  ): string {
    return conversation.developerId === userId
      ? conversation.recruiterId
      : conversation.developerId;
  }

  async createOrGetConversation(
    developerId: string,
    recruiterId: string,
    jobOfferId?: string,
  ) {
    return this.prisma.conversation.upsert({
      where: {
        developerId_recruiterId_jobOfferId: {
          developerId,
          recruiterId,
          jobOfferId: jobOfferId ?? "",
        },
      },
      create: { developerId, recruiterId, jobOfferId: jobOfferId ?? "" },
      update: {},
    });
  }

  async listConversations(userId: string) {
    const conversations = await this.prisma.conversation.findMany({
      where: { OR: [{ developerId: userId }, { recruiterId: userId }] },
      orderBy: { createdAt: "desc" },
    });

    return Promise.all(
      conversations.map(async (conversation) => {
        const [lastMessages, unreadCount] = await Promise.all([
          this.prisma.message.findMany({
            where: { conversationId: conversation.id },
            orderBy: { createdAt: "desc" },
            take: 1,
          }),
          this.prisma.message.count({
            where: {
              conversationId: conversation.id,
              senderId: { not: userId },
              readAt: null,
            },
          }),
        ]);
        return {
          ...conversation,
          lastMessage: lastMessages[0] ?? null,
          unreadCount,
        };
      }),
    );
  }

  async getMessages(conversationId: string, requesterId: string, page: number) {
    await this.requireParticipant(conversationId, requesterId);

    const skip = (page - 1) * PAGE_SIZE;
    const [data, total] = await Promise.all([
      this.prisma.message.findMany({
        where: { conversationId },
        orderBy: { createdAt: "asc" },
        skip,
        take: PAGE_SIZE,
      }),
      this.prisma.message.count({ where: { conversationId } }),
    ]);

    return { data, total, page, pageSize: PAGE_SIZE };
  }

  async sendMessage(conversationId: string, senderId: string, content: string) {
    const conversation = await this.requireParticipant(
      conversationId,
      senderId,
    );
    const recipientId = this.otherParticipant(conversation, senderId);

    return this.prisma.$transaction(async (tx) => {
      const message = await tx.message.create({
        data: { conversationId, senderId, content },
      });
      await tx.outboxEvent.create({
        data: {
          type: Events.MESSAGE_SENT,
          payload: {
            conversationId,
            messageId: message.id,
            senderId,
            recipientId,
            content,
            jobOfferId: conversation.jobOfferId || undefined,
          },
        },
      });
      return { ...message, recipientId };
    });
  }

  async markRead(conversationId: string, requesterId: string) {
    await this.requireParticipant(conversationId, requesterId);

    const { count } = await this.prisma.message.updateMany({
      where: { conversationId, senderId: { not: requesterId }, readAt: null },
      data: { readAt: new Date() },
    });
    return { updated: count };
  }

  // Suppression définitive (pas de "soft delete" par participant : le modèle
  // actuel est une conversation à 2 participants, donc l'un comme l'autre la
  // supprime pour les deux — les messages sont supprimés en cascade (Prisma)).
  async deleteConversation(conversationId: string, requesterId: string) {
    await this.requireParticipant(conversationId, requesterId);
    await this.prisma.conversation.delete({ where: { id: conversationId } });
    return { deleted: true };
  }
}
