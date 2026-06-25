import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from "@nestjs/common";
import * as amqplib from "amqplib";
import { ApplicationsService } from "../applications/applications.service";

const EXCHANGE = "adopte-ton-dev";
const QUEUE = "applications-svc.user-deleted";
const ROUTING_KEYS = ["user.deleted"];

/**
 * RGPD (CLAUDE.md §25/§28) : quand un développeur supprime son compte
 * (auth-service émet user.deleted), on supprime ses candidatures. Les
 * comptes recruteur n'ont rien à nettoyer côté applications-svc.
 */
@Injectable()
export class RabbitConsumerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RabbitConsumerService.name);
  private connection: amqplib.ChannelModel | null = null;
  private channel: amqplib.Channel | null = null;

  constructor(private readonly applicationsService: ApplicationsService) {}

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
      const payload = JSON.parse(msg.content.toString()) as {
        userId: string;
        role: string;
      };
      if (payload.role === "DEVELOPER") {
        await this.applicationsService.deleteAllForDeletedDeveloper(
          payload.userId,
        );
        this.logger.log(
          `Candidatures supprimées pour le développeur supprimé ${payload.userId}`,
        );
      }
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
