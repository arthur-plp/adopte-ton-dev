import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as amqplib from "amqplib";

const RELAY_INTERVAL_MS = 5_000;
const MAX_ATTEMPTS = 3;
const EXCHANGE = "adopte-ton-dev";

@Injectable()
export class OutboxRelayService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OutboxRelayService.name);
  private timer: ReturnType<typeof setInterval> | null = null;
  private connection: amqplib.ChannelModel | null = null;
  private channel: amqplib.Channel | null = null;
  private dbUrl: string = "";

  constructor(private readonly config: ConfigService) {}

  async onModuleInit() {
    this.dbUrl = process.env["DATABASE_URL"] ?? "";
    await this.connectAmqp();
    this.timer = setInterval(() => void this.flush(), RELAY_INTERVAL_MS);
  }

  async onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    try {
      await this.channel?.close();
    } catch {
      /* ignore */
    }
    try {
      await this.connection?.close();
    } catch {
      /* ignore */
    }
  }

  private async connectAmqp() {
    const url = this.config.get<string>(
      "CLOUDAMQP_URL",
      "amqp://atd:atd_dev_password@localhost:5672",
    );
    try {
      const conn = await amqplib.connect(url);
      this.connection = conn;
      this.channel = await conn.createChannel();
      await this.channel.assertExchange(EXCHANGE, "topic", { durable: true });
      this.logger.log("Connexion RabbitMQ établie (jobs-svc)");
    } catch (err) {
      this.logger.warn(
        `RabbitMQ non disponible — outbox en attente : ${String(err)}`,
      );
    }
  }

  async flush(): Promise<void> {
    if (!this.channel || !this.dbUrl) return;

    let pg: typeof import("pg");
    try {
      pg = await import("pg");
    } catch {
      return;
    }

    const client = new pg.Client({ connectionString: this.dbUrl });
    try {
      await client.connect();

      const { rows: events } = await client.query<{
        id: string;
        type: string;
        payload: unknown;
        attempts: number;
      }>(
        `SELECT id, type, payload, attempts FROM "OutboxEvent"
         WHERE status = 'PENDING' AND attempts < $1
         ORDER BY "createdAt" ASC LIMIT 50`,
        [MAX_ATTEMPTS],
      );

      for (const event of events) {
        try {
          const payload = Buffer.from(JSON.stringify(event.payload));
          this.channel.publish(EXCHANGE, event.type, payload, {
            persistent: true,
            messageId: event.id,
          });
          await client.query(
            `UPDATE "OutboxEvent" SET status = 'SENT', "sentAt" = NOW() WHERE id = $1`,
            [event.id],
          );
        } catch (err) {
          this.logger.error(
            `Échec publication event ${event.id} : ${String(err)}`,
          );
          const newAttempts = event.attempts + 1;
          const newStatus = newAttempts >= MAX_ATTEMPTS ? "FAILED" : "PENDING";
          await client.query(
            `UPDATE "OutboxEvent" SET attempts = $1, status = $2 WHERE id = $3`,
            [newAttempts, newStatus, event.id],
          );
        }
      }
    } catch (err) {
      this.logger.warn(`Outbox flush échoué : ${String(err)}`);
    } finally {
      await client.end().catch(() => {
        /* ignore */
      });
    }
  }
}
