import { Controller } from "@nestjs/common";
import { MessagePattern, Payload } from "@nestjs/microservices";
import { ApplicationsService } from "./applications.service";
import type {
  CreateApplicationDto,
  UpdateApplicationStatusDto,
  CreateDocumentRequestDto,
  CreateUploadUrlDto,
  ConfirmUploadDto,
} from "@repo/contracts";

@Controller()
export class ApplicationsController {
  constructor(private readonly service: ApplicationsService) {}

  @MessagePattern({ cmd: "application.create" })
  create(@Payload() data: { developerId: string; dto: CreateApplicationDto }) {
    return this.service.create(data.developerId, data.dto);
  }

  @MessagePattern({ cmd: "application.findMine" })
  findMine(@Payload() data: { developerId: string }) {
    return this.service.findMine(data.developerId);
  }

  @MessagePattern({ cmd: "application.withdraw" })
  withdraw(@Payload() data: { id: string; developerId: string }) {
    return this.service.withdraw(data.id, data.developerId);
  }

  @MessagePattern({ cmd: "application.reactivate" })
  reactivate(@Payload() data: { id: string; developerId: string }) {
    return this.service.reactivate(data.id, data.developerId);
  }

  @MessagePattern({ cmd: "application.findByJobOffer" })
  findByJobOffer(@Payload() data: { jobOfferId: string; recruiterId: string }) {
    return this.service.findByJobOffer(data.jobOfferId, data.recruiterId);
  }

  @MessagePattern({ cmd: "application.updateStatus" })
  updateStatus(
    @Payload()
    data: {
      id: string;
      recruiterId: string;
      dto: UpdateApplicationStatusDto;
    },
  ) {
    return this.service.updateStatus(data.id, data.recruiterId, data.dto);
  }

  @MessagePattern({ cmd: "application.getHistory" })
  getHistory(
    @Payload()
    data: {
      id: string;
      requesterId: string;
      requesterRole: "DEVELOPER" | "RECRUITER" | "ADMIN";
      isAdmin: boolean;
    },
  ) {
    return this.service.getHistory(
      data.id,
      data.requesterId,
      data.requesterRole,
      data.isAdmin,
    );
  }

  @MessagePattern({ cmd: "application.hasActiveForJobOffer" })
  hasActiveForJobOffer(@Payload() data: { jobOfferId: string }) {
    return this.service.hasActiveApplicationsForJobOffer(data.jobOfferId);
  }

  // ── Pièces justificatives ────────────────────────────────────────────────

  @MessagePattern({ cmd: "application.documentRequest.create" })
  createDocumentRequest(
    @Payload()
    data: {
      applicationId: string;
      requesterId: string;
      requesterRole: "DEVELOPER" | "RECRUITER";
      dto: CreateDocumentRequestDto;
    },
  ) {
    return this.service.createDocumentRequest(
      data.applicationId,
      data.requesterId,
      data.requesterRole,
      data.dto,
    );
  }

  @MessagePattern({ cmd: "application.documentRequest.list" })
  listDocumentRequests(
    @Payload()
    data: {
      applicationId: string;
      requesterId: string;
      requesterRole: "DEVELOPER" | "RECRUITER";
    },
  ) {
    return this.service.listDocumentRequests(
      data.applicationId,
      data.requesterId,
      data.requesterRole,
    );
  }

  @MessagePattern({ cmd: "application.documentRequest.createUploadUrl" })
  createUploadUrl(
    @Payload()
    data: {
      requestId: string;
      developerId: string;
      dto: CreateUploadUrlDto;
    },
  ) {
    return this.service.createUploadUrl(
      data.requestId,
      data.developerId,
      data.dto,
    );
  }

  @MessagePattern({ cmd: "application.documentRequest.confirmUpload" })
  confirmUpload(
    @Payload()
    data: {
      requestId: string;
      developerId: string;
      dto: ConfirmUploadDto;
    },
  ) {
    return this.service.confirmUpload(
      data.requestId,
      data.developerId,
      data.dto,
    );
  }

  @MessagePattern({ cmd: "application.documentRequest.downloadUrl" })
  getDownloadUrl(
    @Payload()
    data: {
      requestId: string;
      requesterId: string;
      requesterRole: "DEVELOPER" | "RECRUITER";
      disposition?: "inline" | "attachment";
    },
  ) {
    return this.service.getDownloadUrl(
      data.requestId,
      data.requesterId,
      data.requesterRole,
      data.disposition,
    );
  }

  @MessagePattern({ cmd: "application.documentRequest.delete" })
  deleteDocument(@Payload() data: { requestId: string; developerId: string }) {
    return this.service.deleteDocument(data.requestId, data.developerId);
  }
}
