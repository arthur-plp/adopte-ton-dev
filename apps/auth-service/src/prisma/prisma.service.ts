import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '../../generated/prisma';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

// Interface merging : donne à PrismaService les types de tous les delegates
// (outboxEvent, developerProfile, $transaction, etc.) sans hériter de la classe.
// Le runtime utilise un Proxy pour forwarder les accès vers le vrai PrismaClient.
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface PrismaService extends PrismaClient {}

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  private readonly _prisma: PrismaClient;

  constructor() {
    const pool = new Pool({
      connectionString: process.env['DATABASE_URL'] ?? '',
      keepAlive: true,
      keepAliveInitialDelayMillis: 10000,
      idleTimeoutMillis: 30000,
      max: 10,
    });
    const adapter = new PrismaPg(pool);
    this._prisma = new PrismaClient({ adapter });

    return new Proxy(this, {
      get(target, prop, receiver) {
        if (prop === '_prisma' || prop === 'onModuleInit' || prop === 'onModuleDestroy') {
          return Reflect.get(target, prop, receiver);
        }
        const val = Reflect.get(target._prisma, prop, target._prisma);
        if (val !== undefined) {
          return typeof val === 'function' ? (val as (...args: unknown[]) => unknown).bind(target._prisma) : val;
        }
        return Reflect.get(target, prop, receiver);
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
