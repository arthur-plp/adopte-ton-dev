import { Inject, Injectable } from "@nestjs/common";
import { ClientProxy, RpcException } from "@nestjs/microservices";
import { lastValueFrom } from "rxjs";
import { PrismaService } from "../prisma/prisma.service";
import { S3Service } from "../documents/s3.service";
import { Events, MAX_DOCUMENT_FILE_SIZE_BYTES } from "@repo/contracts";
import { ApplicationStatus, InterviewMode, JobStatus } from "@repo/types";
import type {
  CreateApplicationDto,
  UpdateApplicationStatusDto,
  CreateDocumentRequestDto,
  CreateUploadUrlDto,
  ConfirmUploadDto,
} from "@repo/contracts";

type JobOffer = { id: string; recruiterId: string; status: JobStatus };

const TERMINAL_STATUSES: ApplicationStatus[] = [
  ApplicationStatus.ACCEPTED,
  ApplicationStatus.REJECTED,
  ApplicationStatus.WITHDRAWN,
];

async function retry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err: unknown) {
      if ((err as { code?: string }).code === "P1017" && i < attempts - 1) {
        await new Promise((r) => setTimeout(r, 200 * (i + 1)));
        continue;
      }
      throw err;
    }
  }
  throw new Error("unreachable");
}

@Injectable()
export class ApplicationsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject("JOBS_SVC") private readonly jobsClient: ClientProxy,
    private readonly s3: S3Service,
  ) {}

  // ── Helpers ───────────────────────────────────────────────────────────────

  private async fetchJobOffer(jobOfferId: string): Promise<JobOffer> {
    try {
      return await lastValueFrom(
        this.jobsClient.send<JobOffer>(
          { cmd: "job.findOne" },
          { id: jobOfferId, publicOnly: false },
        ),
      );
    } catch (err: unknown) {
      const e = err as { statusCode?: number; message?: string };
      throw new RpcException({
        statusCode: e.statusCode ?? 500,
        message: e.message ?? "Erreur lors de la vérification de l'offre",
      });
    }
  }

  private async requireApplication(id: string) {
    const application = await retry(() =>
      this.prisma.application.findUnique({ where: { id } }),
    );
    if (!application)
      throw new RpcException({
        statusCode: 404,
        message: "Candidature introuvable",
      });
    return application;
  }

  private requireDeveloperOwner(
    application: { developerId: string },
    developerId: string,
  ) {
    if (application.developerId !== developerId)
      throw new RpcException({ statusCode: 403, message: "Accès refusé" });
  }

  private async requireRecruiterOwnsOffer(
    jobOfferId: string,
    recruiterId: string,
  ) {
    const offer = await this.fetchJobOffer(jobOfferId);
    if (offer.recruiterId !== recruiterId)
      throw new RpcException({ statusCode: 403, message: "Accès refusé" });
    return offer;
  }

  private emitEvent(type: string, payload: object) {
    return this.prisma.outboxEvent.create({ data: { type, payload } });
  }

  private writeHistoryEvent(
    applicationId: string,
    status: ApplicationStatus,
    actorRole: "DEVELOPER" | "RECRUITER",
    actorId: string,
    note: string | null = null,
  ) {
    return this.prisma.applicationEvent.create({
      data: { applicationId, status, actorRole, actorId, note },
    });
  }

  // ── Candidature (développeur) ────────────────────────────────────────────

  async create(developerId: string, dto: CreateApplicationDto) {
    const offer = await this.fetchJobOffer(dto.jobOfferId);
    if (offer.status !== JobStatus.PUBLISHED)
      throw new RpcException({
        statusCode: 400,
        message: "Seules les offres publiées acceptent des candidatures.",
      });

    const existing = await retry(() =>
      this.prisma.application.findUnique({
        where: {
          jobOfferId_developerId: {
            jobOfferId: dto.jobOfferId,
            developerId,
          },
        },
      }),
    );
    if (existing)
      throw new RpcException({
        statusCode: 409,
        message: "Une candidature existe déjà pour cette offre.",
      });

    const application = await this.prisma.application.create({
      data: {
        jobOfferId: dto.jobOfferId,
        developerId,
        coverLetter: dto.coverLetter,
      },
    });

    await this.writeHistoryEvent(
      application.id,
      ApplicationStatus.SENT,
      "DEVELOPER",
      developerId,
    );
    await this.emitEvent(Events.APPLICATION_CREATED, {
      applicationId: application.id,
      jobOfferId: dto.jobOfferId,
      developerId,
      recruiterId: offer.recruiterId,
    });

    return application;
  }

  async findMine(developerId: string) {
    return retry(() =>
      this.prisma.application.findMany({
        where: { developerId },
        orderBy: { createdAt: "desc" },
      }),
    );
  }

  async withdraw(applicationId: string, developerId: string) {
    const application = await this.requireApplication(applicationId);
    this.requireDeveloperOwner(application, developerId);

    if (TERMINAL_STATUSES.includes(application.status as ApplicationStatus))
      throw new RpcException({
        statusCode: 400,
        message: "Cette candidature ne peut plus être retirée.",
      });

    const [withdrawn] = await this.prisma.$transaction([
      this.prisma.application.update({
        where: { id: applicationId },
        data: { status: ApplicationStatus.WITHDRAWN },
      }),
      this.writeHistoryEvent(
        applicationId,
        ApplicationStatus.WITHDRAWN,
        "DEVELOPER",
        developerId,
      ),
      this.emitEvent(Events.APPLICATION_STATUS_CHANGED, {
        applicationId,
        developerId: application.developerId,
        status: ApplicationStatus.WITHDRAWN,
      }),
    ]);
    return withdrawn;
  }

  // Réactivation réservée aux candidatures retirées par erreur ou changement
  // d'avis — un rejet recruteur (REJECTED), lui, n'est jamais réactivable
  // unilatéralement par le candidat.
  async reactivate(applicationId: string, developerId: string) {
    const application = await this.requireApplication(applicationId);
    this.requireDeveloperOwner(application, developerId);

    if (application.status !== ApplicationStatus.WITHDRAWN)
      throw new RpcException({
        statusCode: 400,
        message: "Seule une candidature retirée peut être réactivée.",
      });

    const offer = await this.fetchJobOffer(application.jobOfferId);
    if (offer.status !== JobStatus.PUBLISHED)
      throw new RpcException({
        statusCode: 400,
        message: "Cette offre n'est plus disponible.",
      });

    const [reactivated] = await this.prisma.$transaction([
      this.prisma.application.update({
        where: { id: applicationId },
        data: { status: ApplicationStatus.SENT },
      }),
      this.writeHistoryEvent(
        applicationId,
        ApplicationStatus.SENT,
        "DEVELOPER",
        developerId,
      ),
      this.emitEvent(Events.APPLICATION_STATUS_CHANGED, {
        applicationId,
        developerId: application.developerId,
        status: ApplicationStatus.SENT,
      }),
    ]);
    return reactivated;
  }

  // ── Candidatures (recruteur) ─────────────────────────────────────────────

  async findByJobOffer(jobOfferId: string, recruiterId: string) {
    await this.requireRecruiterOwnsOffer(jobOfferId, recruiterId);

    const applications = await retry(() =>
      this.prisma.application.findMany({
        where: { jobOfferId },
        orderBy: { createdAt: "desc" },
      }),
    );

    const sentApplications = applications.filter(
      (a) => a.status === ApplicationStatus.SENT,
    );

    if (sentApplications.length === 0) return applications;

    await this.prisma.application.updateMany({
      where: { jobOfferId, status: ApplicationStatus.SENT },
      data: { status: ApplicationStatus.VIEWED },
    });
    for (const app of sentApplications) {
      await this.writeHistoryEvent(
        app.id,
        ApplicationStatus.VIEWED,
        "RECRUITER",
        recruiterId,
      );
    }

    const viewedIds = new Set(sentApplications.map((a) => a.id));
    return applications.map((a) =>
      viewedIds.has(a.id) ? { ...a, status: ApplicationStatus.VIEWED } : a,
    );
  }

  async updateStatus(
    applicationId: string,
    recruiterId: string,
    dto: UpdateApplicationStatusDto,
  ) {
    const application = await this.requireApplication(applicationId);
    await this.requireRecruiterOwnsOffer(application.jobOfferId, recruiterId);

    if (TERMINAL_STATUSES.includes(application.status as ApplicationStatus))
      throw new RpcException({
        statusCode: 400,
        message: "Cette candidature est déjà dans un état définitif.",
      });

    if (dto.status === ApplicationStatus.WITHDRAWN)
      throw new RpcException({
        statusCode: 400,
        message: "Seul le développeur peut retirer sa candidature.",
      });

    if (
      dto.status === ApplicationStatus.ACCEPTED &&
      application.status !== ApplicationStatus.INTERVIEW
    )
      throw new RpcException({
        statusCode: 400,
        message:
          "Un entretien doit avoir eu lieu avant d'accepter la candidature.",
      });

    const isInterview = dto.status === ApplicationStatus.INTERVIEW;

    const [updated] = await this.prisma.$transaction([
      this.prisma.application.update({
        where: { id: applicationId },
        data: {
          status: dto.status,
          ...(isInterview && {
            interviewMode: dto.interviewMode ?? null,
            interviewLocation: dto.interviewLocation ?? null,
          }),
        },
      }),
      this.writeHistoryEvent(
        applicationId,
        dto.status,
        "RECRUITER",
        recruiterId,
        this.buildStatusNote(dto),
      ),
      this.emitEvent(Events.APPLICATION_STATUS_CHANGED, {
        applicationId,
        developerId: application.developerId,
        status: dto.status,
      }),
    ]);
    return updated;
  }

  private buildStatusNote(dto: UpdateApplicationStatusDto): string | null {
    if (dto.status !== ApplicationStatus.INTERVIEW || !dto.interviewMode) {
      return dto.note ?? null;
    }
    const modeLabel =
      dto.interviewMode === InterviewMode.REMOTE
        ? "Entretien en distanciel"
        : "Entretien en présentiel";
    const locationLabel = dto.interviewLocation
      ? ` — ${dto.interviewMode === InterviewMode.REMOTE ? "lien" : "adresse"} : ${dto.interviewLocation}`
      : "";
    const base = `${modeLabel}${locationLabel}`;
    return dto.note ? `${base}\n${dto.note}` : base;
  }

  // ── Historique ───────────────────────────────────────────────────────────

  async getHistory(
    applicationId: string,
    requesterId: string,
    requesterRole: "DEVELOPER" | "RECRUITER" | "ADMIN",
    isAdmin: boolean,
  ) {
    const application = await this.requireApplication(applicationId);

    if (!isAdmin) {
      if (requesterRole === "DEVELOPER") {
        this.requireDeveloperOwner(application, requesterId);
      } else {
        await this.requireRecruiterOwnsOffer(
          application.jobOfferId,
          requesterId,
        );
      }
    }

    return retry(() =>
      this.prisma.applicationEvent.findMany({
        where: { applicationId },
        orderBy: { createdAt: "asc" },
      }),
    );
  }

  // Appelé par jobs-svc avant d'autoriser l'archivage/la suppression d'une
  // offre : une candidature ACCEPTED/REJECTED/WITHDRAWN est résolue et ne
  // bloque pas (ex. archiver après une embauche réussie reste possible).
  async hasActiveApplicationsForJobOffer(jobOfferId: string) {
    const count = await retry(() =>
      this.prisma.application.count({
        where: { jobOfferId, status: { notIn: TERMINAL_STATUSES } },
      }),
    );
    return { hasActive: count > 0 };
  }

  // ── Pièces justificatives ────────────────────────────────────────────────

  private async requireDocumentRequest(requestId: string) {
    const request = await retry(() =>
      this.prisma.documentRequest.findUnique({ where: { id: requestId } }),
    );
    if (!request)
      throw new RpcException({
        statusCode: 404,
        message: "Demande de document introuvable",
      });
    return request;
  }

  // Une candidature terminée (acceptée, rejetée ou retirée) ne doit plus
  // échanger de documents : plus de nouvelle demande, plus de dépôt de fichier.
  private requireApplicationNotTerminal(application: {
    status: ApplicationStatus | string;
  }) {
    if (TERMINAL_STATUSES.includes(application.status as ApplicationStatus))
      throw new RpcException({
        statusCode: 400,
        message:
          "Cette candidature est terminée, les documents ne peuvent plus être modifiés.",
      });
  }

  // Une demande peut venir du recruteur ("pièce justificative demandée") ou
  // du développeur lui-même (document joint spontanément à sa candidature) —
  // l'ownership vérifié diffère selon le rôle, le reste du flux (upload/confirm)
  // est identique pour les deux.
  async createDocumentRequest(
    applicationId: string,
    requesterId: string,
    requesterRole: "DEVELOPER" | "RECRUITER",
    dto: CreateDocumentRequestDto,
  ) {
    const application = await this.requireApplication(applicationId);

    if (requesterRole === "DEVELOPER") {
      this.requireDeveloperOwner(application, requesterId);
    } else {
      await this.requireRecruiterOwnsOffer(application.jobOfferId, requesterId);
    }

    this.requireApplicationNotTerminal(application);

    const label = dto.label.trim();
    const existing = await this.prisma.documentRequest.findFirst({
      where: { applicationId, label: { equals: label, mode: "insensitive" } },
    });
    if (existing)
      throw new RpcException({
        statusCode: 409,
        message: "Un document de ce type existe déjà pour cette candidature.",
      });

    return this.prisma.documentRequest.create({
      data: {
        applicationId,
        label,
        note: dto.note ?? null,
        source: requesterRole,
      },
    });
  }

  async listDocumentRequests(
    applicationId: string,
    requesterId: string,
    requesterRole: "DEVELOPER" | "RECRUITER",
  ) {
    const application = await this.requireApplication(applicationId);

    if (requesterRole === "DEVELOPER") {
      this.requireDeveloperOwner(application, requesterId);
    } else {
      await this.requireRecruiterOwnsOffer(application.jobOfferId, requesterId);
    }

    return retry(() =>
      this.prisma.documentRequest.findMany({
        where: { applicationId },
        orderBy: { createdAt: "desc" },
      }),
    );
  }

  async createUploadUrl(
    requestId: string,
    developerId: string,
    dto: CreateUploadUrlDto,
  ) {
    const request = await this.requireDocumentRequest(requestId);
    const application = await this.requireApplication(request.applicationId);
    this.requireDeveloperOwner(application, developerId);
    this.requireApplicationNotTerminal(application);

    const safeFileName = dto.fileName.replace(/[^a-zA-Z0-9.\-_]/g, "_");
    const fileKey = `applications/${application.id}/${requestId}/${Date.now()}-${safeFileName}`;
    const post = await this.s3.createUploadPost(
      fileKey,
      dto.contentType,
      MAX_DOCUMENT_FILE_SIZE_BYTES,
    );
    return { uploadUrl: post.url, fields: post.fields, fileKey };
  }

  async confirmUpload(
    requestId: string,
    developerId: string,
    dto: ConfirmUploadDto,
  ) {
    const request = await this.requireDocumentRequest(requestId);
    const application = await this.requireApplication(request.applicationId);
    this.requireDeveloperOwner(application, developerId);
    this.requireApplicationNotTerminal(application);

    return this.prisma.documentRequest.update({
      where: { id: requestId },
      data: {
        status: "FULFILLED",
        fileKey: dto.fileKey,
        fileName: dto.fileName,
        fulfilledAt: new Date(),
      },
    });
  }

  async getDownloadUrl(
    requestId: string,
    requesterId: string,
    requesterRole: "DEVELOPER" | "RECRUITER",
    disposition: "inline" | "attachment" = "attachment",
  ) {
    const request = await this.requireDocumentRequest(requestId);
    const application = await this.requireApplication(request.applicationId);

    if (requesterRole === "DEVELOPER") {
      this.requireDeveloperOwner(application, requesterId);
    } else {
      await this.requireRecruiterOwnsOffer(application.jobOfferId, requesterId);
    }

    if (!request.fileKey)
      throw new RpcException({
        statusCode: 400,
        message: "Aucun fichier n'a encore été déposé pour cette demande.",
      });

    const downloadUrl = await this.s3.createDownloadUrl(
      request.fileKey,
      request.fileName,
      disposition,
    );
    return { downloadUrl, fileName: request.fileName };
  }

  // Seul le développeur propriétaire de la candidature peut supprimer un
  // fichier déposé. Si le document avait été ajouté de sa propre initiative
  // (source DEVELOPER), la demande disparaît entièrement ; si elle avait été
  // demandée par le recruteur (source RECRUITER), elle redevient PENDING pour
  // qu'il puisse en déposer un nouveau — le recruteur attend toujours une réponse.
  async deleteDocument(requestId: string, developerId: string) {
    const request = await this.requireDocumentRequest(requestId);
    const application = await this.requireApplication(request.applicationId);
    this.requireDeveloperOwner(application, developerId);

    if (!request.fileKey)
      throw new RpcException({
        statusCode: 400,
        message: "Aucun fichier à supprimer pour cette demande.",
      });

    await this.s3.deleteObject(request.fileKey);

    if (request.source === "DEVELOPER") {
      await this.prisma.documentRequest.delete({ where: { id: requestId } });
      return { removed: true, requestId };
    }

    return this.prisma.documentRequest.update({
      where: { id: requestId },
      data: {
        status: "PENDING",
        fileKey: null,
        fileName: null,
        fulfilledAt: null,
      },
    });
  }

  async getStats() {
    const [total, grouped] = await Promise.all([
      retry(() => this.prisma.application.count()),
      retry(() =>
        this.prisma.application.groupBy({
          by: ["status"],
          _count: { status: true },
        }),
      ),
    ]);
    const byStatus = Object.fromEntries(
      grouped.map((g) => [g.status, g._count.status]),
    ) as Partial<Record<ApplicationStatus, number>>;
    const accepted = byStatus[ApplicationStatus.ACCEPTED] ?? 0;
    const rejected = byStatus[ApplicationStatus.REJECTED] ?? 0;
    const decided = accepted + rejected;
    return {
      total,
      sent: byStatus[ApplicationStatus.SENT] ?? 0,
      viewed: byStatus[ApplicationStatus.VIEWED] ?? 0,
      interview: byStatus[ApplicationStatus.INTERVIEW] ?? 0,
      accepted,
      rejected,
      withdrawn: byStatus[ApplicationStatus.WITHDRAWN] ?? 0,
      acceptanceRate: decided > 0 ? Math.round((accepted / decided) * 100) : 0,
    };
  }

  /**
   * Consumer de l'event user.deleted (RGPD, CLAUDE.md §25/§28) : un
   * développeur a supprimé son compte — ses candidatures (et leur historique/
   * pièces justificatives, cascade Prisma) sont supprimées, il n'a plus
   * vocation à suivre leur statut.
   */
  async deleteAllForDeletedDeveloper(developerId: string) {
    const { count } = await this.prisma.application.deleteMany({
      where: { developerId },
    });
    return { deleted: count };
  }
}
