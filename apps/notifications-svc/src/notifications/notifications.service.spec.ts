import { Test, TestingModule } from "@nestjs/testing";
import { ForbiddenException } from "@nestjs/common";
import { of, throwError } from "rxjs";
import { NotificationsService } from "./notifications.service";
import { PrismaService } from "../prisma/prisma.service";

const mockGatewayClient = { send: jest.fn() };

const mockPrisma = {
  notification: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  jobAlertSubscription: {
    upsert: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
  },
  processedEvent: {
    findUnique: jest.fn(),
    create: jest.fn(),
  },
};

describe("NotificationsService", () => {
  let service: NotificationsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: "GATEWAY_SVC", useValue: mockGatewayClient },
      ],
    }).compile();
    service = module.get<NotificationsService>(NotificationsService);
    jest.clearAllMocks();
    mockGatewayClient.send.mockReturnValue(of({ delivered: true }));
  });

  describe("create", () => {
    it("persiste une notification", async () => {
      const created = {
        id: "notif-1",
        userId: "user-1",
        type: "APPLICATION",
        payload: { applicationId: "app-1" },
        readAt: null,
        createdAt: new Date(),
      };
      mockPrisma.notification.create.mockResolvedValue(created);

      const result = await service.create("user-1", "APPLICATION", {
        applicationId: "app-1",
      });

      expect(mockPrisma.notification.create).toHaveBeenCalledWith({
        data: {
          userId: "user-1",
          type: "APPLICATION",
          payload: { applicationId: "app-1" },
        },
      });
      expect(result).toEqual(created);
    });

    it("pousse la notification en temps réel via la gateway", async () => {
      const created = {
        id: "notif-1",
        userId: "user-1",
        type: "APPLICATION",
        payload: {},
        readAt: null,
        createdAt: new Date(),
      };
      mockPrisma.notification.create.mockResolvedValue(created);

      await service.create("user-1", "APPLICATION", {});

      expect(mockGatewayClient.send).toHaveBeenCalledWith(
        { cmd: "realtime.pushToUser" },
        { userId: "user-1", event: "notification.new", payload: created },
      );
    });

    it("ne fait pas échouer create si le push temps réel échoue", async () => {
      mockPrisma.notification.create.mockResolvedValue({ id: "notif-1" });
      mockGatewayClient.send.mockReturnValue(
        throwError(() => new Error("gateway down")),
      );

      await expect(
        service.create("user-1", "APPLICATION", {}),
      ).resolves.toEqual({ id: "notif-1" });
    });
  });

  describe("list", () => {
    it("retourne les notifications paginées de l'utilisateur, plus récentes en premier", async () => {
      mockPrisma.notification.findMany.mockResolvedValue([]);
      mockPrisma.notification.count.mockResolvedValue(0);

      const result = await service.list("user-1", 1);

      expect(mockPrisma.notification.findMany).toHaveBeenCalledWith({
        where: { userId: "user-1" },
        orderBy: { createdAt: "desc" },
        skip: 0,
        take: 20,
      });
      expect(result).toEqual({ data: [], total: 0, page: 1, pageSize: 20 });
    });
  });

  describe("markRead", () => {
    it("rejette si la notification n'appartient pas au requester (403)", async () => {
      mockPrisma.notification.findUnique.mockResolvedValue({
        id: "notif-1",
        userId: "user-2",
      });

      await expect(service.markRead("notif-1", "user-1")).rejects.toThrow(
        ForbiddenException,
      );
    });

    it("marque la notification comme lue si elle appartient au requester", async () => {
      mockPrisma.notification.findUnique.mockResolvedValue({
        id: "notif-1",
        userId: "user-1",
      });
      mockPrisma.notification.update.mockResolvedValue({
        id: "notif-1",
        userId: "user-1",
        readAt: new Date(),
      });

      await service.markRead("notif-1", "user-1");

      expect(mockPrisma.notification.update).toHaveBeenCalledWith({
        where: { id: "notif-1" },
        data: { readAt: expect.any(Date) },
      });
    });
  });

  describe("markAllRead", () => {
    it("marque toutes les notifications non lues de l'utilisateur comme lues", async () => {
      mockPrisma.notification.updateMany.mockResolvedValue({ count: 3 });

      const result = await service.markAllRead("user-1");

      expect(mockPrisma.notification.updateMany).toHaveBeenCalledWith({
        where: { userId: "user-1", readAt: null },
        data: { readAt: expect.any(Date) },
      });
      expect(result).toEqual({ updated: 3 });
    });
  });

  describe("upsertJobAlert", () => {
    it("crée ou met à jour l'abonnement du développeur", async () => {
      const subscription = {
        id: "sub-1",
        developerId: "dev-1",
        technologies: ["React"],
        remoteOk: true,
        location: null,
      };
      mockPrisma.jobAlertSubscription.upsert.mockResolvedValue(subscription);

      const result = await service.upsertJobAlert("dev-1", {
        technologies: ["React"],
        remoteOk: true,
      });

      expect(mockPrisma.jobAlertSubscription.upsert).toHaveBeenCalledWith({
        where: { developerId: "dev-1" },
        create: {
          developerId: "dev-1",
          technologies: ["React"],
          remoteOk: true,
          location: undefined,
        },
        update: {
          technologies: ["React"],
          remoteOk: true,
          location: undefined,
        },
      });
      expect(result).toEqual(subscription);
    });
  });

  describe("getJobAlert", () => {
    it("retourne l'abonnement du développeur (ou null)", async () => {
      mockPrisma.jobAlertSubscription.findUnique.mockResolvedValue(null);
      const result = await service.getJobAlert("dev-1");
      expect(result).toBeNull();
    });
  });

  describe("deleteJobAlert", () => {
    it("supprime l'abonnement du développeur", async () => {
      mockPrisma.jobAlertSubscription.deleteMany.mockResolvedValue({
        count: 1,
      });
      const result = await service.deleteJobAlert("dev-1");
      expect(mockPrisma.jobAlertSubscription.deleteMany).toHaveBeenCalledWith({
        where: { developerId: "dev-1" },
      });
      expect(result).toEqual({ deleted: true });
    });
  });

  describe("isEventProcessed / markEventProcessed", () => {
    it("isEventProcessed retourne false si l'event n'a jamais été vu", async () => {
      mockPrisma.processedEvent.findUnique.mockResolvedValue(null);
      const result = await service.isEventProcessed("msg-1");
      expect(result).toBe(false);
    });

    it("isEventProcessed retourne true si l'event a déjà été traité", async () => {
      mockPrisma.processedEvent.findUnique.mockResolvedValue({
        messageId: "msg-1",
      });
      const result = await service.isEventProcessed("msg-1");
      expect(result).toBe(true);
    });

    it("markEventProcessed enregistre le messageId", async () => {
      await service.markEventProcessed("msg-1");
      expect(mockPrisma.processedEvent.create).toHaveBeenCalledWith({
        data: { messageId: "msg-1" },
      });
    });
  });
});
