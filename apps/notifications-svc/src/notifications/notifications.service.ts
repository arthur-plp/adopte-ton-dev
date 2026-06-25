import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { ClientProxy } from "@nestjs/microservices";
import { lastValueFrom } from "rxjs";
import { PrismaService } from "../prisma/prisma.service";
import type { UpsertJobAlertDto } from "@repo/contracts";

const PAGE_SIZE = 20;

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject("GATEWAY_SVC") private readonly gatewayClient: ClientProxy,
  ) {}

  async create(userId: string, type: string, payload: object) {
    const notification = await this.prisma.notification.create({
      data: { userId, type, payload },
    });
    this.pushRealtime(userId, notification);
    return notification;
  }

  private pushRealtime(userId: string, notification: unknown) {
    lastValueFrom(
      this.gatewayClient.send(
        { cmd: "realtime.pushToUser" },
        { userId, event: "notification.new", payload: notification },
      ),
    ).catch(() => {
      // best-effort : la notification est déjà persistée, le front la
      // récupérera via le polling REST de secours si le push échoue
    });
  }

  async list(userId: string, page: number) {
    const skip = (page - 1) * PAGE_SIZE;
    const [data, total] = await Promise.all([
      this.prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        skip,
        take: PAGE_SIZE,
      }),
      this.prisma.notification.count({ where: { userId } }),
    ]);
    return { data, total, page, pageSize: PAGE_SIZE };
  }

  async markRead(id: string, requesterId: string) {
    const notification = await this.prisma.notification.findUnique({
      where: { id },
    });
    if (!notification) throw new NotFoundException("Notification introuvable");
    if (notification.userId !== requesterId) throw new ForbiddenException();

    return this.prisma.notification.update({
      where: { id },
      data: { readAt: new Date() },
    });
  }

  async markAllRead(userId: string) {
    const { count } = await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { updated: count };
  }

  async upsertJobAlert(developerId: string, dto: UpsertJobAlertDto) {
    return this.prisma.jobAlertSubscription.upsert({
      where: { developerId },
      create: {
        developerId,
        technologies: dto.technologies,
        remoteOk: dto.remoteOk,
        location: dto.location,
      },
      update: {
        technologies: dto.technologies,
        remoteOk: dto.remoteOk,
        location: dto.location,
      },
    });
  }

  async getJobAlert(developerId: string) {
    return this.prisma.jobAlertSubscription.findUnique({
      where: { developerId },
    });
  }

  async deleteJobAlert(developerId: string) {
    await this.prisma.jobAlertSubscription.deleteMany({
      where: { developerId },
    });
    return { deleted: true };
  }

  async listAllJobAlerts() {
    return this.prisma.jobAlertSubscription.findMany();
  }

  async isEventProcessed(messageId: string): Promise<boolean> {
    const existing = await this.prisma.processedEvent.findUnique({
      where: { messageId },
    });
    return existing !== null;
  }

  async markEventProcessed(messageId: string) {
    await this.prisma.processedEvent.create({ data: { messageId } });
  }
}
