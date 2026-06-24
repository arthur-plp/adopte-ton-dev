import {
  CanActivate,
  ExecutionContext,
  HttpException,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import Redis from 'ioredis';
import type { Request, Response } from 'express';

const WINDOW_SECONDS = parseInt(
  process.env['RATE_LIMIT_WINDOW_SECONDS'] ?? '60',
  10,
);
const MAX_REQUESTS = parseInt(
  process.env['RATE_LIMIT_MAX_REQUESTS'] ?? '100',
  10,
);

// Rate-limiting partagé entre toutes les instances de la gateway (compteur en
// mémoire ne tient pas en multi-instances, cf. CLAUDE.md §29). Fail-open si
// Redis est injoignable : une panne du cache ne doit pas rendre l'API
// indisponible, seulement désactiver temporairement la limite.
@Injectable()
export class RedisRateLimitGuard
  implements CanActivate, OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(RedisRateLimitGuard.name);
  private client!: Redis;

  onModuleInit() {
    this.client = new Redis(
      process.env['REDIS_URL'] ?? 'redis://localhost:6379',
    );
  }

  async onModuleDestroy() {
    await this.client.quit();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const key = `ratelimit:${request.ip}:${request.path}`;

    try {
      const count = await this.client.incr(key);
      if (count === 1) await this.client.expire(key, WINDOW_SECONDS);

      if (count > MAX_REQUESTS) {
        const retryAfter = await this.client.ttl(key);
        response.setHeader('Retry-After', Math.max(retryAfter, 1).toString());
        throw new HttpException('Trop de requêtes, réessayez plus tard.', 429);
      }
      return true;
    } catch (err: unknown) {
      if (err instanceof HttpException) throw err;
      this.logger.warn(
        `Redis injoignable, rate-limiting désactivé : ${String(err)}`,
      );
      return true;
    }
  }
}
