import { Controller } from "@nestjs/common";
import { MessagePattern, Payload } from "@nestjs/microservices";
import { NotificationsService } from "./notifications.service";
import type { UpsertJobAlertDto } from "@repo/contracts";

@Controller()
export class NotificationsController {
  constructor(private readonly service: NotificationsService) {}

  @MessagePattern({ cmd: "notifications.list" })
  list(@Payload() data: { userId: string; page: number }) {
    return this.service.list(data.userId, data.page);
  }

  @MessagePattern({ cmd: "notifications.markRead" })
  markRead(@Payload() data: { id: string; requesterId: string }) {
    return this.service.markRead(data.id, data.requesterId);
  }

  @MessagePattern({ cmd: "notifications.markAllRead" })
  markAllRead(@Payload() data: { userId: string }) {
    return this.service.markAllRead(data.userId);
  }

  @MessagePattern({ cmd: "notifications.upsertJobAlert" })
  upsertJobAlert(
    @Payload() data: { developerId: string; dto: UpsertJobAlertDto },
  ) {
    return this.service.upsertJobAlert(data.developerId, data.dto);
  }

  @MessagePattern({ cmd: "notifications.getJobAlert" })
  getJobAlert(@Payload() data: { developerId: string }) {
    return this.service.getJobAlert(data.developerId);
  }

  @MessagePattern({ cmd: "notifications.deleteJobAlert" })
  deleteJobAlert(@Payload() data: { developerId: string }) {
    return this.service.deleteJobAlert(data.developerId);
  }
}
