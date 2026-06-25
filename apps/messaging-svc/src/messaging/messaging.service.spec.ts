import { Test, TestingModule } from "@nestjs/testing";
import { ForbiddenException } from "@nestjs/common";
import { MessagingService } from "./messaging.service";
import { PrismaService } from "../prisma/prisma.service";

const mockPrisma = {
  conversation: {
    upsert: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    delete: jest.fn(),
  },
  message: {
    create: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    updateMany: jest.fn(),
  },
  outboxEvent: { create: jest.fn() },
  $transaction: jest.fn(),
};

const conversation = {
  id: "conv-1",
  developerId: "dev-1",
  recruiterId: "recruiter-1",
  jobOfferId: "",
  createdAt: new Date(),
};

describe("MessagingService", () => {
  let service: MessagingService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MessagingService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get<MessagingService>(MessagingService);
    jest.clearAllMocks();
    mockPrisma.$transaction.mockImplementation(
      (callback: (tx: typeof mockPrisma) => Promise<unknown>) =>
        callback(mockPrisma),
    );
  });

  describe("createOrGetConversation", () => {
    it("crée (ou récupère) la conversation via upsert sur la contrainte unique", async () => {
      mockPrisma.conversation.upsert.mockResolvedValue(conversation);

      const result = await service.createOrGetConversation(
        "dev-1",
        "recruiter-1",
        undefined,
      );

      expect(mockPrisma.conversation.upsert).toHaveBeenCalledWith({
        where: {
          developerId_recruiterId_jobOfferId: {
            developerId: "dev-1",
            recruiterId: "recruiter-1",
            jobOfferId: "",
          },
        },
        create: {
          developerId: "dev-1",
          recruiterId: "recruiter-1",
          jobOfferId: "",
        },
        update: {},
      });
      expect(result).toEqual(conversation);
    });
  });

  describe("listConversations", () => {
    it("retourne les conversations de l'utilisateur avec dernier message et compteur non-lus", async () => {
      mockPrisma.conversation.findMany.mockResolvedValue([conversation]);
      mockPrisma.message.findMany.mockResolvedValue([
        {
          id: "m1",
          conversationId: "conv-1",
          senderId: "recruiter-1",
          content: "Bonjour",
          readAt: null,
          createdAt: new Date(),
        },
      ]);
      mockPrisma.message.count.mockResolvedValue(1);

      const result = await service.listConversations("dev-1");

      expect(mockPrisma.conversation.findMany).toHaveBeenCalledWith({
        where: { OR: [{ developerId: "dev-1" }, { recruiterId: "dev-1" }] },
        orderBy: { createdAt: "desc" },
      });
      expect(result).toEqual([
        {
          ...conversation,
          lastMessage: expect.objectContaining({ id: "m1" }),
          unreadCount: 1,
        },
      ]);
    });
  });

  describe("getMessages", () => {
    it("rejette si le requester n'est ni le développeur ni le recruteur (403)", async () => {
      mockPrisma.conversation.findUnique.mockResolvedValue(conversation);

      await expect(
        service.getMessages("conv-1", "un-tiers", 1),
      ).rejects.toThrow(ForbiddenException);
    });

    it("retourne les messages paginés si le requester est participant", async () => {
      mockPrisma.conversation.findUnique.mockResolvedValue(conversation);
      mockPrisma.message.findMany.mockResolvedValue([
        {
          id: "m1",
          conversationId: "conv-1",
          senderId: "dev-1",
          content: "Salut",
          readAt: null,
          createdAt: new Date(),
        },
      ]);
      mockPrisma.message.count.mockResolvedValue(1);

      const result = await service.getMessages("conv-1", "dev-1", 1);

      expect(result.total).toBe(1);
      expect(result.data).toHaveLength(1);
    });
  });

  describe("sendMessage", () => {
    it("rejette si le sender n'est pas participant de la conversation (403)", async () => {
      mockPrisma.conversation.findUnique.mockResolvedValue(conversation);

      await expect(
        service.sendMessage("conv-1", "un-tiers", "Salut"),
      ).rejects.toThrow(ForbiddenException);
    });

    it("crée le message et l'event MESSAGE_SENT avec le bon recipientId (dev → recruteur)", async () => {
      mockPrisma.conversation.findUnique.mockResolvedValue(conversation);
      const created = {
        id: "m1",
        conversationId: "conv-1",
        senderId: "dev-1",
        content: "Salut",
        readAt: null,
        createdAt: new Date(),
      };
      mockPrisma.message.create.mockResolvedValue(created);

      const result = await service.sendMessage("conv-1", "dev-1", "Salut");

      expect(mockPrisma.outboxEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: "message.sent",
          payload: expect.objectContaining({
            conversationId: "conv-1",
            messageId: "m1",
            senderId: "dev-1",
            recipientId: "recruiter-1",
            content: "Salut",
          }),
        }),
      });
      expect(result).toEqual({ ...created, recipientId: "recruiter-1" });
    });

    it("calcule le bon recipientId quand c'est le recruteur qui envoie (recruteur → dev)", async () => {
      mockPrisma.conversation.findUnique.mockResolvedValue(conversation);
      mockPrisma.message.create.mockResolvedValue({
        id: "m2",
        conversationId: "conv-1",
        senderId: "recruiter-1",
        content: "Bonjour",
        readAt: null,
        createdAt: new Date(),
      });

      await service.sendMessage("conv-1", "recruiter-1", "Bonjour");

      expect(mockPrisma.outboxEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          payload: expect.objectContaining({ recipientId: "dev-1" }),
        }),
      });
    });
  });

  describe("markRead", () => {
    it("rejette si le requester n'est pas participant (403)", async () => {
      mockPrisma.conversation.findUnique.mockResolvedValue(conversation);

      await expect(service.markRead("conv-1", "un-tiers")).rejects.toThrow(
        ForbiddenException,
      );
    });

    it("marque comme lus les messages non envoyés par le requester", async () => {
      mockPrisma.conversation.findUnique.mockResolvedValue(conversation);
      mockPrisma.message.updateMany.mockResolvedValue({ count: 2 });

      const result = await service.markRead("conv-1", "dev-1");

      expect(mockPrisma.message.updateMany).toHaveBeenCalledWith({
        where: {
          conversationId: "conv-1",
          senderId: { not: "dev-1" },
          readAt: null,
        },
        data: { readAt: expect.any(Date) },
      });
      expect(result).toEqual({ updated: 2 });
    });
  });

  describe("deleteConversation", () => {
    it("rejette si le requester n'est pas participant (403)", async () => {
      mockPrisma.conversation.findUnique.mockResolvedValue(conversation);

      await expect(
        service.deleteConversation("conv-1", "un-tiers"),
      ).rejects.toThrow(ForbiddenException);
      expect(mockPrisma.conversation.delete).not.toHaveBeenCalled();
    });

    it("supprime la conversation (et ses messages, cascade Prisma) si le requester est participant", async () => {
      mockPrisma.conversation.findUnique.mockResolvedValue(conversation);
      mockPrisma.conversation.delete.mockResolvedValue(conversation);

      const result = await service.deleteConversation("conv-1", "dev-1");

      expect(mockPrisma.conversation.delete).toHaveBeenCalledWith({
        where: { id: "conv-1" },
      });
      expect(result).toEqual({ deleted: true });
    });
  });
});
