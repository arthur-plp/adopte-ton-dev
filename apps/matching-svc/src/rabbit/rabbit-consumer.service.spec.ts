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
import { RedisService } from "../redis/redis.service";

const mockAmqp = amqplib as jest.Mocked<typeof amqplib>;

const mockRedis = {
  flushPrefix: jest.fn(),
} as unknown as RedisService;

describe("RabbitConsumerService", () => {
  let service: RabbitConsumerService;

  beforeEach(() => {
    jest.clearAllMocks();
    (mockAmqp.connect as jest.Mock).mockResolvedValue(mockConnection);
    mockConnection.createChannel.mockResolvedValue(mockChannel);
    service = new RabbitConsumerService(mockRedis);
  });

  it("se connecte, déclare l'exchange/queue et bind les routing keys attendues", async () => {
    await service.onModuleInit();

    expect(mockChannel.assertExchange).toHaveBeenCalledWith(
      "adopte-ton-dev",
      "topic",
      { durable: true },
    );
    expect(mockChannel.assertQueue).toHaveBeenCalledWith(
      "matching-svc.cache-invalidation",
      { durable: true },
    );
    expect(mockChannel.bindQueue).toHaveBeenCalledWith(
      "matching-svc.cache-invalidation",
      "adopte-ton-dev",
      "developer.profile.updated",
    );
    expect(mockChannel.bindQueue).toHaveBeenCalledWith(
      "matching-svc.cache-invalidation",
      "adopte-ton-dev",
      "job.published",
    );
    expect(mockChannel.consume).toHaveBeenCalled();
  });

  it("invalide le cache et acquitte le message à la réception d'un event", async () => {
    await service.onModuleInit();
    const onMessage = mockChannel.consume.mock.calls[0][1] as (
      msg: unknown,
    ) => Promise<void>;
    (mockRedis.flushPrefix as jest.Mock).mockResolvedValue(undefined);

    const msg = {
      fields: { routingKey: "job.published" },
      content: Buffer.from("{}"),
    };
    await onMessage(msg);

    expect(mockRedis.flushPrefix).toHaveBeenCalledWith("matching:");
    expect(mockChannel.ack).toHaveBeenCalledWith(msg);
  });

  it("nack le message (avec requeue) si l'invalidation échoue", async () => {
    await service.onModuleInit();
    const onMessage = mockChannel.consume.mock.calls[0][1] as (
      msg: unknown,
    ) => Promise<void>;
    (mockRedis.flushPrefix as jest.Mock).mockRejectedValue(
      new Error("redis down"),
    );

    const msg = {
      fields: { routingKey: "job.published" },
      content: Buffer.from("{}"),
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
