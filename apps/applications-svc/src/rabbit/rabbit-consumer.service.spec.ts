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

import * as amqplib from "amqplib";
import { RabbitConsumerService } from "./rabbit-consumer.service";
import { ApplicationsService } from "../applications/applications.service";

const mockAmqp = amqplib as jest.Mocked<typeof amqplib>;

const mockApplicationsService = {
  deleteAllForDeletedDeveloper: jest.fn(),
} as unknown as ApplicationsService;

describe("RabbitConsumerService (applications-svc)", () => {
  let service: RabbitConsumerService;

  beforeEach(() => {
    jest.clearAllMocks();
    (mockAmqp.connect as jest.Mock).mockResolvedValue(mockConnection);
    mockConnection.createChannel.mockResolvedValue(mockChannel);
    service = new RabbitConsumerService(mockApplicationsService);
  });

  it("se connecte, déclare l'exchange/queue et bind la routing key user.deleted", async () => {
    await service.onModuleInit();

    expect(mockChannel.assertExchange).toHaveBeenCalledWith(
      "adopte-ton-dev",
      "topic",
      { durable: true },
    );
    expect(mockChannel.bindQueue).toHaveBeenCalledWith(
      "applications-svc.user-deleted",
      "adopte-ton-dev",
      "user.deleted",
    );
    expect(mockChannel.consume).toHaveBeenCalled();
  });

  it("supprime les candidatures du développeur supprimé et acquitte le message", async () => {
    await service.onModuleInit();
    const onMessage = mockChannel.consume.mock.calls[0][1] as (
      msg: unknown,
    ) => Promise<void>;
    (
      mockApplicationsService.deleteAllForDeletedDeveloper as jest.Mock
    ).mockResolvedValue({ deleted: 2 });

    const msg = {
      fields: { routingKey: "user.deleted" },
      content: Buffer.from(
        JSON.stringify({ userId: "dev-1", role: "DEVELOPER" }),
      ),
    };
    await onMessage(msg);

    expect(
      mockApplicationsService.deleteAllForDeletedDeveloper,
    ).toHaveBeenCalledWith("dev-1");
    expect(mockChannel.ack).toHaveBeenCalledWith(msg);
  });

  it("ignore les comptes recruteur (rien à supprimer) et acquitte tout de même", async () => {
    await service.onModuleInit();
    const onMessage = mockChannel.consume.mock.calls[0][1] as (
      msg: unknown,
    ) => Promise<void>;

    const msg = {
      fields: { routingKey: "user.deleted" },
      content: Buffer.from(
        JSON.stringify({ userId: "recruiter-1", role: "RECRUITER" }),
      ),
    };
    await onMessage(msg);

    expect(
      mockApplicationsService.deleteAllForDeletedDeveloper,
    ).not.toHaveBeenCalled();
    expect(mockChannel.ack).toHaveBeenCalledWith(msg);
  });

  it("nack le message (avec requeue) si le traitement échoue", async () => {
    await service.onModuleInit();
    const onMessage = mockChannel.consume.mock.calls[0][1] as (
      msg: unknown,
    ) => Promise<void>;
    (
      mockApplicationsService.deleteAllForDeletedDeveloper as jest.Mock
    ).mockRejectedValue(new Error("db down"));

    const msg = {
      fields: { routingKey: "user.deleted" },
      content: Buffer.from(
        JSON.stringify({ userId: "dev-1", role: "DEVELOPER" }),
      ),
    };
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
