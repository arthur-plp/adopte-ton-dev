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

import { of, throwError } from "rxjs";
import * as amqplib from "amqplib";
import { RabbitConsumerService } from "./rabbit-consumer.service";
import { MailerService } from "../mailer/mailer.service";
import { PrismaService } from "../prisma/prisma.service";
import type { ClientProxy } from "@nestjs/microservices";

const mockAmqp = amqplib as jest.Mocked<typeof amqplib>;

const mockMailer = { send: jest.fn() } as unknown as MailerService;
const mockPrisma = {
  processedEvent: { findUnique: jest.fn(), create: jest.fn() },
} as unknown as PrismaService;
const mockAuthClient = { send: jest.fn() } as unknown as ClientProxy;
const mockJobsClient = { send: jest.fn() } as unknown as ClientProxy;

function buildMsg(routingKey: string, payload: object, messageId?: string) {
  return {
    fields: { routingKey },
    properties: { messageId },
    content: Buffer.from(JSON.stringify(payload)),
  };
}

const developer = {
  firstName: "Dev",
  lastName: "Junior",
  email: "dev@test.com",
};
const recruiter = {
  firstName: "Bob",
  lastName: "Rec",
  email: "recruiter@test.com",
};
const offer = { id: "job-1", title: "Dev Fullstack" };

describe("RabbitConsumerService (email-svc)", () => {
  let service: RabbitConsumerService;

  beforeEach(() => {
    jest.clearAllMocks();
    (mockPrisma.processedEvent.findUnique as jest.Mock).mockResolvedValue(null);
    (mockAmqp.connect as jest.Mock).mockResolvedValue(mockConnection);
    mockConnection.createChannel.mockResolvedValue(mockChannel);
    service = new RabbitConsumerService(
      mockMailer,
      mockPrisma,
      mockAuthClient,
      mockJobsClient,
    );
  });

  it("bind les 3 routing keys attendues", async () => {
    await service.onModuleInit();

    const keys = mockChannel.bindQueue.mock.calls.map((c) => c[2]);
    expect(keys).toEqual(
      expect.arrayContaining([
        "application.created",
        "application.status.changed",
        "message.sent",
      ]),
    );
  });

  it("ignore (ack direct) un event déjà traité (idempotence)", async () => {
    (mockPrisma.processedEvent.findUnique as jest.Mock).mockResolvedValue({
      messageId: "evt-1",
    });
    await service.onModuleInit();
    const onMessage = mockChannel.consume.mock.calls[0][1] as (
      msg: unknown,
    ) => Promise<void>;

    const msg = buildMsg("application.created", { recruiterId: "r1" }, "evt-1");
    await onMessage(msg);

    expect(mockMailer.send).not.toHaveBeenCalled();
    expect(mockChannel.ack).toHaveBeenCalledWith(msg);
  });

  it("application.created → envoie l'email au recruteur", async () => {
    (mockAuthClient.send as jest.Mock).mockReturnValueOnce(of(recruiter));
    (mockAuthClient.send as jest.Mock).mockReturnValueOnce(of(developer));
    (mockJobsClient.send as jest.Mock).mockReturnValueOnce(of(offer));
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

    expect(mockAuthClient.send).toHaveBeenCalledWith(
      { cmd: "recruiter.getProfile" },
      { userId: "recruiter-1" },
    );
    expect(mockAuthClient.send).toHaveBeenCalledWith(
      { cmd: "developer.getProfile" },
      { userId: "dev-1" },
    );
    expect(mockMailer.send).toHaveBeenCalledWith(
      "recruiter@test.com",
      expect.stringContaining("Dev Fullstack"),
      expect.anything(),
    );
    expect(mockPrisma.processedEvent.create).toHaveBeenCalledWith({
      data: { messageId: "evt-1" },
    });
    expect(mockChannel.ack).toHaveBeenCalledWith(msg);
  });

  it("application.status.changed → envoie l'email au développeur", async () => {
    (mockAuthClient.send as jest.Mock).mockReturnValueOnce(of(developer));
    (mockJobsClient.send as jest.Mock).mockReturnValueOnce(of(offer));
    await service.onModuleInit();
    const onMessage = mockChannel.consume.mock.calls[0][1] as (
      msg: unknown,
    ) => Promise<void>;

    const msg = buildMsg(
      "application.status.changed",
      {
        applicationId: "app-1",
        jobOfferId: "job-1",
        developerId: "dev-1",
        status: "ACCEPTED",
      },
      "evt-2",
    );
    await onMessage(msg);

    expect(mockAuthClient.send).toHaveBeenCalledWith(
      { cmd: "developer.getProfile" },
      { userId: "dev-1" },
    );
    expect(mockMailer.send).toHaveBeenCalledWith(
      "dev@test.com",
      expect.stringContaining("Dev Fullstack"),
      expect.anything(),
    );
  });

  it("ignore application.status.changed si jobOfferId est absent (event legacy)", async () => {
    await service.onModuleInit();
    const onMessage = mockChannel.consume.mock.calls[0][1] as (
      msg: unknown,
    ) => Promise<void>;

    const msg = buildMsg(
      "application.status.changed",
      { applicationId: "app-1", developerId: "dev-1", status: "ACCEPTED" },
      "evt-2b",
    );
    await onMessage(msg);

    expect(mockMailer.send).not.toHaveBeenCalled();
    expect(mockChannel.ack).toHaveBeenCalledWith(msg);
  });

  it("message.sent → envoie l'email au destinataire (résolution dev/recruteur par essai)", async () => {
    (mockAuthClient.send as jest.Mock).mockImplementation(
      (pattern: { cmd: string }, data: { userId: string }) => {
        if (pattern.cmd === "developer.getProfile" && data.userId === "dev-1") {
          return of(developer);
        }
        if (
          pattern.cmd === "recruiter.getProfile" &&
          data.userId === "recruiter-1"
        ) {
          return of(recruiter);
        }
        return throwError(() => new Error("not found"));
      },
    );
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
        content: "Bonjour, je suis disponible.",
      },
      "evt-3",
    );
    await onMessage(msg);

    expect(mockMailer.send).toHaveBeenCalledWith(
      "recruiter@test.com",
      expect.any(String),
      expect.anything(),
    );
  });

  it("nack le message (avec requeue) si le traitement échoue", async () => {
    (mockAuthClient.send as jest.Mock).mockImplementation(() => {
      throw new Error("auth-service down");
    });
    await service.onModuleInit();
    const onMessage = mockChannel.consume.mock.calls[0][1] as (
      msg: unknown,
    ) => Promise<void>;

    const msg = buildMsg("application.created", { recruiterId: "r1" }, "evt-4");
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
