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
import { MailerService } from "../mailer/mailer.service";
import { PrismaService } from "../prisma/prisma.service";
import { ApplicationReceivedEmail } from "../templates/application-received";
import { ApplicationStatusChangedEmail } from "../templates/application-status-changed";
import { NewMessageEmail } from "../templates/new-message";

const EXCHANGE = "adopte-ton-dev";
const QUEUE = "email-svc.events";
const ROUTING_KEYS = [
  "application.created",
  "application.status.changed",
  "message.sent",
];

type Profile = { firstName: string; lastName: string; email: string };
type JobOfferLike = { id: string; title: string };

const WEB_URL = process.env["WEB_URL"] ?? "http://localhost:3000";

// Les erreurs RPC NestJS (microservices) sont souvent de simples objets
// ({statusCode, message}), pas des Error — String(err) donnerait "[object
// Object]", inutilisable pour diagnostiquer un échec en prod.
function describeError(err: unknown): string {
  if (err instanceof Error) return err.message;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

@Injectable()
export class RabbitConsumerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RabbitConsumerService.name);
  private connection: amqplib.ChannelModel | null = null;
  private channel: amqplib.Channel | null = null;

  constructor(
    private readonly mailer: MailerService,
    private readonly prisma: PrismaService,
    @Inject("AUTH_SVC") private readonly authClient: ClientProxy,
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
      this.logger.error(`Connexion RabbitMQ échouée : ${describeError(err)}`);
    }
  }

  // Identité normalisée (développeur, recruteur ou admin) — un admin n'a ni
  // DeveloperProfile ni RecruiterProfile, users.getParticipantInfo gère ce
  // repli côté auth-service (cf. apps/api-gateway/.../messaging.controller.ts
  // qui utilise la même commande pour la messagerie).
  private async getParticipant(userId: string) {
    return lastValueFrom(
      this.authClient.send<Profile>(
        { cmd: "users.getParticipantInfo" },
        { userId },
      ),
    );
  }

  private async getJobOffer(jobOfferId: string) {
    return lastValueFrom(
      this.jobsClient.send<JobOfferLike>(
        { cmd: "job.findOne" },
        { id: jobOfferId },
      ),
    );
  }

  private async handleMessage(msg: amqplib.ConsumeMessage | null) {
    if (!msg || !this.channel) return;
    const messageId = msg.properties.messageId as string | undefined;

    try {
      if (messageId) {
        const already = await this.prisma.processedEvent.findUnique({
          where: { messageId },
        });
        if (already) {
          this.channel.ack(msg);
          return;
        }
      }

      const payload = JSON.parse(msg.content.toString()) as Record<
        string,
        unknown
      >;

      switch (msg.fields.routingKey) {
        case "application.created":
          await this.handleApplicationCreated(payload);
          break;
        case "application.status.changed":
          await this.handleApplicationStatusChanged(payload);
          break;
        case "message.sent":
          await this.handleMessageSent(payload);
          break;
        default:
          break;
      }

      if (messageId) {
        await this.prisma.processedEvent.create({ data: { messageId } });
      }
      this.channel.ack(msg);
    } catch (err) {
      this.logger.error(`Échec traitement event : ${describeError(err)}`);
      this.channel.nack(msg, false, true);
    }
  }

  private async handleApplicationCreated(payload: Record<string, unknown>) {
    const jobOfferId = payload["jobOfferId"] as string;
    const developerId = payload["developerId"] as string;
    const recruiterId = payload["recruiterId"] as string;

    const [recruiter, developer, offer] = await Promise.all([
      this.getParticipant(recruiterId),
      this.getParticipant(developerId),
      this.getJobOffer(jobOfferId),
    ]);

    await this.mailer.send(
      recruiter.email,
      `Nouvelle candidature pour « ${offer.title} »`,
      ApplicationReceivedEmail({
        recruiterName: recruiter.firstName,
        developerName: `${developer.firstName} ${developer.lastName}`,
        jobTitle: offer.title,
        applicationUrl: `${WEB_URL}/jobs/${offer.id}/edit`,
      }),
    );
  }

  private async handleApplicationStatusChanged(
    payload: Record<string, unknown>,
  ) {
    const jobOfferId = payload["jobOfferId"] as string | undefined;
    if (!jobOfferId) {
      this.logger.warn(
        "application.status.changed sans jobOfferId — email non envoyé",
      );
      return;
    }
    const developerId = payload["developerId"] as string;
    const status = payload["status"] as string;

    const [developer, offer] = await Promise.all([
      this.getParticipant(developerId),
      this.getJobOffer(jobOfferId),
    ]);

    await this.mailer.send(
      developer.email,
      `Ta candidature pour « ${offer.title} » a évolué`,
      ApplicationStatusChangedEmail({
        developerName: developer.firstName,
        jobTitle: offer.title,
        status,
        applicationUrl: `${WEB_URL}/applications`,
      }),
    );
  }

  private async handleMessageSent(payload: Record<string, unknown>) {
    const senderId = payload["senderId"] as string;
    const recipientId = payload["recipientId"] as string;
    const content = payload["content"] as string;
    const conversationId = payload["conversationId"] as string;

    const [sender, recipient] = await Promise.all([
      this.getParticipant(senderId),
      this.getParticipant(recipientId),
    ]);

    await this.mailer.send(
      recipient.email,
      `Nouveau message de ${sender.firstName} ${sender.lastName}`,
      NewMessageEmail({
        recipientName: recipient.firstName,
        senderName: `${sender.firstName} ${sender.lastName}`,
        contentPreview:
          content.length > 200 ? `${content.slice(0, 200)}…` : content,
        conversationUrl: `${WEB_URL}/messages?c=${conversationId}`,
      }),
    );
  }

  async onModuleDestroy() {
    await this.channel?.close();
    await this.connection?.close();
  }
}
