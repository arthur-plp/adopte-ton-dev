import {
  Inject,
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from "@nestjs/common";
import { ClientProxy } from "@nestjs/microservices";
import { lastValueFrom } from "rxjs";
import * as amqplib from "amqplib";
import { NotificationsService } from "../notifications/notifications.service";
import { matchesJobAlert } from "../notifications/job-alert-matcher";

const EXCHANGE = "adopte-ton-dev";
const QUEUE = "notifications-svc.events";
const ROUTING_KEYS = [
  "application.created",
  "application.status.changed",
  "message.sent",
  "job.published",
];

type JobOfferLike = {
  id: string;
  title: string;
  status: string;
  requiredTechnologies: string[];
  remoteOk: boolean;
  location: string | null;
};

/**
 * Consume les events métier (CLAUDE.md §13.5/§28) pour générer les
 * notifications en base. Idempotent via NotificationsService.isEventProcessed
 * (déduplique sur le messageId posé par l'outbox émetteur).
 */
@Injectable()
export class RabbitConsumerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RabbitConsumerService.name);
  private connection: amqplib.ChannelModel | null = null;
  private channel: amqplib.Channel | null = null;

  constructor(
    private readonly notificationsService: NotificationsService,
    @Inject("JOBS_SVC") private readonly jobsClient: ClientProxy,
  ) {}

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
    const messageId = msg.properties.messageId as string | undefined;

    try {
      if (
        messageId &&
        (await this.notificationsService.isEventProcessed(messageId))
      ) {
        this.channel.ack(msg);
        return;
      }

      const payload = JSON.parse(msg.content.toString()) as Record<
        string,
        unknown
      >;

      switch (msg.fields.routingKey) {
        case "application.created":
          await this.notificationsService.create(
            payload["recruiterId"] as string,
            "APPLICATION",
            payload,
          );
          break;
        case "application.status.changed":
          await this.notificationsService.create(
            payload["developerId"] as string,
            "APPLICATION",
            payload,
          );
          break;
        case "message.sent":
          await this.notificationsService.create(
            payload["recipientId"] as string,
            "MESSAGE",
            payload,
          );
          break;
        case "job.published":
          await this.handleJobPublished(payload["jobOfferId"] as string);
          break;
        default:
          break;
      }

      if (messageId)
        await this.notificationsService.markEventProcessed(messageId);
      this.channel.ack(msg);
    } catch (err) {
      this.logger.error(`Échec traitement event : ${String(err)}`);
      this.channel.nack(msg, false, true);
    }
  }

  private async handleJobPublished(jobOfferId: string) {
    const offer = await lastValueFrom(
      this.jobsClient.send<JobOfferLike>(
        { cmd: "job.findOne" },
        { id: jobOfferId },
      ),
    );
    if (!offer || offer.status !== "PUBLISHED") return;

    const subscriptions = await this.notificationsService.listAllJobAlerts();
    const matches = subscriptions.filter((sub) =>
      matchesJobAlert(
        {
          technologies: sub.technologies,
          remoteOk: sub.remoteOk,
          location: sub.location,
        },
        {
          requiredTechnologies: offer.requiredTechnologies,
          remoteOk: offer.remoteOk,
          location: offer.location,
        },
      ),
    );

    await Promise.all(
      matches.map((sub) =>
        this.notificationsService.create(sub.developerId, "JOB_ALERT", {
          jobOfferId: offer.id,
          title: offer.title,
        }),
      ),
    );
  }

  async onModuleDestroy() {
    await this.channel?.close();
    await this.connection?.close();
  }
}
