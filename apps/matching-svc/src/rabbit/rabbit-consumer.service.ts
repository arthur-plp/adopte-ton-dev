import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from "@nestjs/common";
import * as amqplib from "amqplib";
import { RedisService } from "../redis/redis.service";

const EXCHANGE = "adopte-ton-dev";
const QUEUE = "matching-svc.cache-invalidation";
const ROUTING_KEYS = ["developer.profile.updated", "job.published"];
const CACHE_PREFIX = "matching:";

/**
 * Premier vrai consumer RabbitMQ du repo : matching-svc reste sans état
 * (pas de DB, pas de réindexation) mais invalide son cache Redis quand un
 * profil développeur ou une offre change, plutôt que de servir des résultats
 * obsolètes jusqu'à expiration du TTL.
 */
@Injectable()
export class RabbitConsumerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RabbitConsumerService.name);
  private connection: amqplib.ChannelModel | null = null;
  private channel: amqplib.Channel | null = null;

  constructor(private readonly redis: RedisService) {}

  async onModuleInit() {
    try {
      const conn = await amqplib.connect(
        process.env["CLOUDAMQP_URL"] ?? "amqp://localhost:5672",
      );
      this.connection = conn;
      const channel = await conn.createChannel();
      this.channel = channel;
      await channel.assertExchange(EXCHANGE, "topic", { durable: true });
      await channel.assertQueue(QUEUE, { durable: true });
      for (const routingKey of ROUTING_KEYS) {
        await channel.bindQueue(QUEUE, EXCHANGE, routingKey);
      }
      await channel.consume(QUEUE, (msg) => this.handleMessage(msg));
      this.logger.log(
        `Consumer RabbitMQ prêt (queue "${QUEUE}", routing keys: ${ROUTING_KEYS.join(", ")})`,
      );
    } catch (err) {
      this.logger.error(`Connexion RabbitMQ échouée : ${String(err)}`);
    }
  }

  private async handleMessage(msg: amqplib.ConsumeMessage | null) {
    if (!msg || !this.channel) return;
    try {
      await this.redis.flushPrefix(CACHE_PREFIX);
      this.logger.log(
        `Cache matching invalidé suite à "${msg.fields.routingKey}"`,
      );
      this.channel.ack(msg);
    } catch (err) {
      this.logger.error(`Échec traitement event : ${String(err)}`);
      this.channel.nack(msg, false, true);
    }
  }

  async onModuleDestroy() {
    await this.channel?.close();
    await this.connection?.close();
  }
}
