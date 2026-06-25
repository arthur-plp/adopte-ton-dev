import { Injectable, OnModuleInit, OnModuleDestroy } from "@nestjs/common";
import { PrismaClient } from "../../generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

async function withRetry<T>(fn: () => T | Promise<T>, retries = 3): Promise<T> {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (err: unknown) {
      if ((err as { code?: string }).code === "P1017" && i < retries - 1) {
        await new Promise((r) => setTimeout(r, 200 * (i + 1)));
        continue;
      }
      throw err;
    }
  }
  throw new Error("unreachable");
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface PrismaService extends PrismaClient {}

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  private readonly _prisma: PrismaClient;

  constructor() {
    const pool = new Pool({
      connectionString: process.env["DATABASE_URL"] ?? "",
      keepAlive: true,
      keepAliveInitialDelayMillis: 10000,
      idleTimeoutMillis: 10000,
      connectionTimeoutMillis: 10000,
      max: 5,
    });

    const adapter = new PrismaPg(pool);
    this._prisma = new PrismaClient({ adapter });

    return new Proxy(this, {
      get(target, prop, receiver) {
        if (
          prop === "_prisma" ||
          prop === "onModuleInit" ||
          prop === "onModuleDestroy"
        ) {
          return Reflect.get(target, prop, receiver);
        }
        const val = Reflect.get(target._prisma, prop, target._prisma);
        if (val === undefined) {
          return Reflect.get(target, prop, receiver);
        }
        if (typeof val === "function") {
          const bound = (val as (...args: unknown[]) => unknown).bind(
            target._prisma,
          );
          return (...args: unknown[]) => withRetry(() => bound(...args));
        }
        return val;
      },
    }) as PrismaService;
  }

  async onModuleInit() {
    await this._prisma.$connect();
  }

  async onModuleDestroy() {
    await this._prisma.$disconnect();
  }
}
