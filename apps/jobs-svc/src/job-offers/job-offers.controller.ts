import { Controller } from "@nestjs/common";
import { MessagePattern, Payload } from "@nestjs/microservices";
import { JobOffersService } from "./job-offers.service";
import type {
  CreateJobOfferDto,
  UpdateJobOfferDto,
  JobOfferFiltersDto,
} from "@repo/contracts";

@Controller()
export class JobOffersController {
  constructor(private readonly service: JobOffersService) {}

  @MessagePattern({ cmd: "job.create" })
  create(
    @Payload()
    data: {
      recruiterId: string;
      companyId: string;
      companyName?: string;
      dto: CreateJobOfferDto;
    },
  ) {
    return this.service.create(
      data.recruiterId,
      data.companyId,
      data.dto,
      data.companyName,
    );
  }

  @MessagePattern({ cmd: "job.findMine" })
  findMine(@Payload() data: { recruiterId: string }) {
    return this.service.findMine(data.recruiterId);
  }

  @MessagePattern({ cmd: "job.findOne" })
  findOne(@Payload() data: { id: string; publicOnly?: boolean }) {
    return this.service.findOne(data.id, data.publicOnly ?? false);
  }

  @MessagePattern({ cmd: "job.findPublished" })
  findPublished(
    @Payload()
    data: {
      filters: JobOfferFiltersDto;
      page: number;
      pageSize: number;
    },
  ) {
    return this.service.findPublished(data.filters, data.page, data.pageSize);
  }

  @MessagePattern({ cmd: "job.update" })
  update(
    @Payload()
    data: {
      id: string;
      recruiterId: string;
      dto: UpdateJobOfferDto;
    },
  ) {
    return this.service.update(data.id, data.recruiterId, data.dto);
  }

  @MessagePattern({ cmd: "job.publish" })
  publish(@Payload() data: { id: string; recruiterId: string }) {
    return this.service.publish(data.id, data.recruiterId);
  }

  @MessagePattern({ cmd: "job.archive" })
  archive(@Payload() data: { id: string; recruiterId: string }) {
    return this.service.archive(data.id, data.recruiterId);
  }

  @MessagePattern({ cmd: "job.unarchive" })
  unarchive(@Payload() data: { id: string; recruiterId: string }) {
    return this.service.unarchive(data.id, data.recruiterId);
  }

  @MessagePattern({ cmd: "job.goLive" })
  goLive(@Payload() data: { id: string; recruiterId: string }) {
    return this.service.goLive(data.id, data.recruiterId);
  }

  @MessagePattern({ cmd: "job.delete" })
  delete(@Payload() data: { id: string; recruiterId: string }) {
    return this.service.delete(data.id, data.recruiterId);
  }

  @MessagePattern({ cmd: "job.approve" })
  approve(@Payload() data: { id: string; adminId: string }) {
    return this.service.approve(data.id, data.adminId);
  }

  @MessagePattern({ cmd: "job.reject" })
  reject(@Payload() data: { id: string; reason?: string; adminId: string }) {
    return this.service.reject(data.id, data.reason, data.adminId);
  }

  @MessagePattern({ cmd: "job.resetToDraft" })
  resetToDraft(@Payload() data: { id: string; recruiterId: string }) {
    return this.service.resetToDraft(data.id, data.recruiterId);
  }

  @MessagePattern({ cmd: "job.findPendingReview" })
  findPendingReview(@Payload() data: { page: number; pageSize: number }) {
    return this.service.findPendingReview(data.page, data.pageSize);
  }

  @MessagePattern({ cmd: "job.getHistory" })
  getHistory(
    @Payload() data: { id: string; requesterId: string; isAdmin: boolean },
  ) {
    return this.service.getHistory(data.id, data.requesterId, data.isAdmin);
  }

  @MessagePattern({ cmd: "job.getStats" })
  getStats() {
    return this.service.getStats();
  }
}
