const mockChannel = {
  assertExchange: jest.fn().mockResolvedValue(undefined),
  assertQueue: jest.fn().mockResolvedValue(undefined),
  bindQueue: jest.fn().mockResolvedValue(undefined),
  consume: jest.fn().mockResolvedValue(undefined),
  ack: jest.fn(),
  nack: jest.fn(),
  close: jest.fn().mockResolvedValue(undefined),
};

const mockConnection = {
  createChannel: jest.fn().mockResolvedValue(mockChannel),
  close: jest.fn().mockResolvedValue(undefined),
};

jest.mock("amqplib", () => ({ connect: jest.fn() }));

import { of } from "rxjs";
import * as amqplib from "amqplib";
import { RabbitConsumerService } from "./rabbit-consumer.service";
import { NotificationsService } from "../notifications/notifications.service";
import type { ClientProxy } from "@nestjs/microservices";

const mockAmqp = amqplib as jest.Mocked<typeof amqplib>;

const mockNotificationsService = {
  create: jest.fn(),
  isEventProcessed: jest.fn().mockResolvedValue(false),
  markEventProcessed: jest.fn(),
  listAllJobAlerts: jest.fn().mockResolvedValue([]),
} as unknown as NotificationsService;

const mockJobsClient = { send: jest.fn() } as unknown as ClientProxy;

function buildMsg(routingKey: string, payload: object, messageId?: string) {
  return {
    fields: { routingKey },
    properties: { messageId },
    content: Buffer.from(JSON.stringify(payload)),
  };
}

describe("RabbitConsumerService (notifications-svc)", () => {
  let service: RabbitConsumerService;

  beforeEach(() => {
    jest.clearAllMocks();
    (mockNotificationsService.isEventProcessed as jest.Mock).mockResolvedValue(
      false,
    );
    (mockNotificationsService.listAllJobAlerts as jest.Mock).mockResolvedValue(
      [],
    );
    (mockAmqp.connect as jest.Mock).mockResolvedValue(mockConnection);
    mockConnection.createChannel.mockResolvedValue(mockChannel);
    service = new RabbitConsumerService(
      mockNotificationsService,
      mockJobsClient,
    );
  });

  it("bind les 4 routing keys attendues", async () => {
    await service.onModuleInit();

    const keys = mockChannel.bindQueue.mock.calls.map((c) => c[2]);
    expect(keys).toEqual(
      expect.arrayContaining([
        "application.created",
        "application.status.changed",
        "message.sent",
        "job.published",
      ]),
    );
  });

  it("ignore (ack direct) un event déjà traité (idempotence)", async () => {
    (mockNotificationsService.isEventProcessed as jest.Mock).mockResolvedValue(
      true,
    );
    await service.onModuleInit();
    const onMessage = mockChannel.consume.mock.calls[0][1] as (
      msg: unknown,
    ) => Promise<void>;

    const msg = buildMsg("application.created", { recruiterId: "r1" }, "evt-1");
    await onMessage(msg);

    expect(mockNotificationsService.create).not.toHaveBeenCalled();
    expect(mockChannel.ack).toHaveBeenCalledWith(msg);
  });

  it("application.created → notifie le recruteur", async () => {
    await service.onModuleInit();
    const onMessage = mockChannel.consume.mock.calls[0][1] as (
      msg: unknown,
    ) => Promise<void>;

    const msg = buildMsg(
      "application.created",
      {
        applicationId: "app-1",
        jobOfferId: "job-1",
        developerId: "dev-1",
        recruiterId: "recruiter-1",
      },
      "evt-1",
    );
    await onMessage(msg);

    expect(mockNotificationsService.create).toHaveBeenCalledWith(
      "recruiter-1",
      "APPLICATION",
      expect.objectContaining({ applicationId: "app-1" }),
    );
    expect(mockNotificationsService.markEventProcessed).toHaveBeenCalledWith(
      "evt-1",
    );
    expect(mockChannel.ack).toHaveBeenCalledWith(msg);
  });

  it("application.status.changed → notifie le développeur", async () => {
    await service.onModuleInit();
    const onMessage = mockChannel.consume.mock.calls[0][1] as (
      msg: unknown,
    ) => Promise<void>;

    const msg = buildMsg(
      "application.status.changed",
      { applicationId: "app-1", developerId: "dev-1", status: "ACCEPTED" },
      "evt-2",
    );
    await onMessage(msg);

    expect(mockNotificationsService.create).toHaveBeenCalledWith(
      "dev-1",
      "APPLICATION",
      expect.objectContaining({ status: "ACCEPTED" }),
    );
  });

  it("message.sent → notifie le destinataire", async () => {
    await service.onModuleInit();
    const onMessage = mockChannel.consume.mock.calls[0][1] as (
      msg: unknown,
    ) => Promise<void>;

    const msg = buildMsg(
      "message.sent",
      {
        conversationId: "conv-1",
        messageId: "m1",
        senderId: "dev-1",
        recipientId: "recruiter-1",
        content: "Salut",
      },
      "evt-3",
    );
    await onMessage(msg);

    expect(mockNotificationsService.create).toHaveBeenCalledWith(
      "recruiter-1",
      "MESSAGE",
      expect.objectContaining({ content: "Salut" }),
    );
  });

  describe("job.published", () => {
    it("ne notifie personne si l'offre n'est pas (encore) PUBLISHED", async () => {
      (mockJobsClient.send as jest.Mock).mockReturnValue(
        of({ id: "job-1", status: "DRAFT" }),
      );
      await service.onModuleInit();
      const onMessage = mockChannel.consume.mock.calls[0][1] as (
        msg: unknown,
      ) => Promise<void>;

      const msg = buildMsg("job.published", { jobOfferId: "job-1" }, "evt-4");
      await onMessage(msg);

      expect(mockNotificationsService.create).not.toHaveBeenCalled();
      expect(mockChannel.ack).toHaveBeenCalledWith(msg);
    });

    it("notifie les développeurs dont l'alerte matche l'offre publiée", async () => {
      (mockJobsClient.send as jest.Mock).mockReturnValue(
        of({
          id: "job-1",
          title: "Dev Fullstack",
          status: "PUBLISHED",
          requiredTechnologies: ["React"],
          remoteOk: true,
          location: "Paris",
        }),
      );
      (
        mockNotificationsService.listAllJobAlerts as jest.Mock
      ).mockResolvedValue([
        {
          developerId: "dev-1",
          technologies: ["React"],
          remoteOk: null,
          location: null,
        },
        {
          developerId: "dev-2",
          technologies: ["Java"],
          remoteOk: null,
          location: null,
        },
      ]);
      await service.onModuleInit();
      const onMessage = mockChannel.consume.mock.calls[0][1] as (
        msg: unknown,
      ) => Promise<void>;

      const msg = buildMsg("job.published", { jobOfferId: "job-1" }, "evt-5");
      await onMessage(msg);

      expect(mockNotificationsService.create).toHaveBeenCalledTimes(1);
      expect(mockNotificationsService.create).toHaveBeenCalledWith(
        "dev-1",
        "JOB_ALERT",
        expect.objectContaining({ jobOfferId: "job-1" }),
      );
    });
  });

  it("nack le message (avec requeue) si le traitement échoue", async () => {
    (mockNotificationsService.create as jest.Mock).mockRejectedValue(
      new Error("db down"),
    );
    await service.onModuleInit();
    const onMessage = mockChannel.consume.mock.calls[0][1] as (
      msg: unknown,
    ) => Promise<void>;

    const msg = buildMsg("application.created", { recruiterId: "r1" }, "evt-6");
    await onMessage(msg);

    expect(mockChannel.nack).toHaveBeenCalledWith(msg, false, true);
  });

  it("ferme le canal et la connexion à la destruction du module", async () => {
    await service.onModuleInit();
    await service.onModuleDestroy();

    expect(mockChannel.close).toHaveBeenCalled();
    expect(mockConnection.close).toHaveBeenCalled();
  });
});
