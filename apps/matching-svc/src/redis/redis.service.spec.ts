const mockRedisClient = {
  get: jest.fn(),
  set: jest.fn(),
  keys: jest.fn(),
  del: jest.fn(),
  quit: jest.fn(),
};

jest.mock("ioredis", () => jest.fn(() => mockRedisClient));

import { RedisService } from "./redis.service";

describe("RedisService", () => {
  let service: RedisService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new RedisService();
    service.onModuleInit();
  });

  it("get délègue au client ioredis", async () => {
    mockRedisClient.get.mockResolvedValue("cached-value");
    const result = await service.get("matching:foo");
    expect(result).toBe("cached-value");
    expect(mockRedisClient.get).toHaveBeenCalledWith("matching:foo");
  });

  it("set écrit avec un TTL en secondes", async () => {
    await service.set("matching:foo", "value", 60);
    expect(mockRedisClient.set).toHaveBeenCalledWith(
      "matching:foo",
      "value",
      "EX",
      60,
    );
  });

  it("flushPrefix supprime les clés correspondant au préfixe", async () => {
    mockRedisClient.keys.mockResolvedValue(["matching:a", "matching:b"]);
    await service.flushPrefix("matching:");
    expect(mockRedisClient.keys).toHaveBeenCalledWith("matching:*");
    expect(mockRedisClient.del).toHaveBeenCalledWith(
      "matching:a",
      "matching:b",
    );
  });

  it("flushPrefix ne fait rien si aucune clé ne correspond", async () => {
    mockRedisClient.keys.mockResolvedValue([]);
    await service.flushPrefix("matching:");
    expect(mockRedisClient.del).not.toHaveBeenCalled();
  });

  it("onModuleDestroy ferme la connexion", async () => {
    await service.onModuleDestroy();
    expect(mockRedisClient.quit).toHaveBeenCalled();
  });
});
