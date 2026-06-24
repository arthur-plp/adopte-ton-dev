import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import Redis from "ioredis";

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private client!: Redis;

  onModuleInit() {
    this.client = new Redis(
      process.env["REDIS_URL"] ?? "redis://localhost:6379",
    );
  }

  async onModuleDestroy() {
    await this.client.quit();
  }

  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    await this.client.set(key, value, "EX", ttlSeconds);
  }

  /**
   * Supprime toutes les clés sous un préfixe donné. `KEYS` est acceptable
   * ici (volume de clés modeste, cache de recherche) — un `SCAN` itératif
   * serait préférable à plus grande échelle.
   */
  async flushPrefix(prefix: string): Promise<void> {
    const keys = await this.client.keys(`${prefix}*`);
    if (keys.length > 0) await this.client.del(...keys);
  }
}
