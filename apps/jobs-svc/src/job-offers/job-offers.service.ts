import { Inject, Injectable, Logger } from "@nestjs/common";
import { ClientProxy, RpcException } from "@nestjs/microservices";
import { lastValueFrom } from "rxjs";
import { PrismaService } from "../prisma/prisma.service";
import { Events } from "@repo/contracts";
import { JobStatus, PlanType } from "@repo/types";
import type {
  CreateJobOfferDto,
  UpdateJobOfferDto,
  JobOfferFiltersDto,
} from "@repo/contracts";

const FREE_PLAN_LIMIT = 2;

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
export class JobOffersService {
  private readonly logger = new Logger(JobOffersService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject("APPLICATIONS_SVC")
    private readonly applicationsClient: ClientProxy,
    @Inject("PAYMENT_SVC")
    private readonly paymentClient: ClientProxy,
  ) {}

  private async hasActiveApplications(jobOfferId: string): Promise<boolean> {
    const result = await lastValueFrom(
      this.applicationsClient.send<{ hasActive: boolean }>(
        { cmd: "application.hasActiveForJobOffer" },
        { jobOfferId },
      ),
    );
    return result.hasActive;
  }

  // Si payment-svc est injoignable, on applique le quota Free par défaut
  // (échec fermé) plutôt que d'accorder un accès Pro non vérifié.
  private async getCompanyPlan(companyId: string): Promise<PlanType> {
    try {
      const result = await lastValueFrom(
        this.paymentClient.send<{ plan: string }>(
          { cmd: "payment.getSubscription" },
          { companyId },
        ),
      );
      return result.plan === PlanType.PRO ? PlanType.PRO : PlanType.FREE;
    } catch (err) {
      this.logger.warn(
        `payment-svc injoignable, application du plan Free par défaut : ${String(err)}`,
      );
      return PlanType.FREE;
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private async requireOffer(id: string) {
    const offer = await retry(() =>
      this.prisma.jobOffer.findUnique({ where: { id } }),
    );
    if (!offer)
      throw new RpcException({ statusCode: 404, message: "Offre introuvable" });
    return offer;
  }

  private requireOwner(offer: { recruiterId: string }, recruiterId: string) {
    if (offer.recruiterId !== recruiterId)
      throw new RpcException({ statusCode: 403, message: "Accès refusé" });
  }

  // Un admin peut agir sur n'importe quelle offre (CLAUDE.md §13.6 back-office) ;
  // les autres règles métier (offre PUBLISHED figée, candidatures actives…)
  // s'appliquent identiquement, qu'on soit admin ou propriétaire.
  private requireOwnerUnlessAdmin(
    offer: { recruiterId: string },
    requesterId: string,
    isAdmin: boolean,
  ) {
    if (!isAdmin) this.requireOwner(offer, requesterId);
  }

  private emitEvent(type: string, payload: object) {
    return this.prisma.outboxEvent.create({ data: { type, payload } });
  }

  private writeHistoryEvent(
    jobOfferId: string,
    status: JobStatus,
    actorRole: "RECRUITER" | "ADMIN",
    actorId: string,
    note: string | null = null,
  ) {
    return this.prisma.jobOfferEvent.create({
      data: { jobOfferId, status, actorRole, actorId, note },
    });
  }

  // ── CRUD ─────────────────────────────────────────────────────────────────

  async create(
    recruiterId: string,
    companyId: string,
    dto: CreateJobOfferDto,
    companyName?: string,
    actor?: { role: "RECRUITER" | "ADMIN"; id: string },
  ) {
    return this.prisma.$transaction(async (tx) => {
      const offer = await tx.jobOffer.create({
        data: {
          recruiterId,
          companyId,
          companyName: companyName ?? null,
          ...dto,
        },
      });
      await tx.jobOfferEvent.create({
        data: {
          jobOfferId: offer.id,
          status: offer.status,
          actorRole: actor?.role ?? "RECRUITER",
          actorId: actor?.id ?? recruiterId,
          note: null,
        },
      });
      await tx.outboxEvent.create({
        data: {
          type: Events.JOB_PUBLISHED,
          payload: { recruiterId, companyId, action: "created" },
        },
      });
      return offer;
    });
  }

  async findMine(recruiterId: string) {
    return retry(() =>
      this.prisma.jobOffer.findMany({
        where: { recruiterId },
        orderBy: { createdAt: "desc" },
      }),
    );
  }

  async findOne(id: string, publicOnly = false) {
    const offer = await this.requireOffer(id);
    if (publicOnly && offer.status !== JobStatus.PUBLISHED) {
      throw new RpcException({ statusCode: 404, message: "Offre introuvable" });
    }
    return offer;
  }

  async findPublished(
    filters: JobOfferFiltersDto,
    page: number,
    pageSize: number,
  ) {
    const where: Record<string, unknown> = {
      status: JobStatus.PUBLISHED,
      isPublic: true,
    };
    if (filters.type) where["type"] = filters.type;
    if (filters.remoteOk !== undefined) where["remoteOk"] = filters.remoteOk;
    if (filters.location)
      where["location"] = { contains: filters.location, mode: "insensitive" };
    if (filters.technologies?.length) {
      where["requiredTechnologies"] = { hasSome: filters.technologies };
    }
    if (filters.companyId) where["companyId"] = filters.companyId;

    const skip = (page - 1) * pageSize;
    const [data, total] = await Promise.all([
      retry(() =>
        this.prisma.jobOffer.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip,
          take: pageSize,
        }),
      ),
      retry(() => this.prisma.jobOffer.count({ where })),
    ]);
    return { data, total, page, pageSize };
  }

  async update(
    id: string,
    recruiterId: string,
    dto: UpdateJobOfferDto,
    isAdmin = false,
  ) {
    const offer = await this.requireOffer(id);
    this.requireOwnerUnlessAdmin(offer, recruiterId, isAdmin);

    if (offer.status === JobStatus.PUBLISHED)
      throw new RpcException({
        statusCode: 400,
        message:
          "Une offre publiée ne peut pas être modifiée. Archivez-la pour pouvoir la modifier.",
      });

    const [updated] = await this.prisma.$transaction([
      this.prisma.jobOffer.update({ where: { id }, data: dto }),
      this.emitEvent(Events.JOB_PUBLISHED, {
        jobOfferId: id,
        action: "updated",
      }),
    ]);
    return updated;
  }

  async publish(id: string, recruiterId: string) {
    const offer = await this.requireOffer(id);
    this.requireOwner(offer, recruiterId);

    if (offer.status !== JobStatus.DRAFT && offer.status !== JobStatus.REJECTED)
      throw new RpcException({
        statusCode: 400,
        message:
          "Seules les offres en brouillon ou rejetées peuvent être soumises.",
      });

    const [submitted] = await this.prisma.$transaction([
      this.prisma.jobOffer.update({
        where: { id },
        data: { status: JobStatus.PENDING_REVIEW, rejectionReason: null },
      }),
      this.emitEvent(Events.JOB_PUBLISHED, {
        jobOfferId: id,
        recruiterId,
        companyId: offer.companyId,
        action: "submitted_for_review",
      }),
      this.writeHistoryEvent(
        id,
        JobStatus.PENDING_REVIEW,
        "RECRUITER",
        recruiterId,
      ),
    ]);
    return submitted;
  }

  /** Validation par l'admin : ne publie pas l'offre, c'est au recruteur de le faire via goLive(). */
  async approve(id: string, adminId: string) {
    const offer = await this.requireOffer(id);
    if (offer.status !== JobStatus.PENDING_REVIEW)
      throw new RpcException({
        statusCode: 400,
        message: "Seules les offres en attente peuvent être approuvées.",
      });

    const [approved] = await this.prisma.$transaction([
      this.prisma.jobOffer.update({
        where: { id },
        data: { status: JobStatus.APPROVED, rejectionReason: null },
      }),
      this.writeHistoryEvent(id, JobStatus.APPROVED, "ADMIN", adminId),
    ]);
    return approved;
  }

  /** Le recruteur décide de rendre une offre approuvée visible publiquement. Quota Free vérifié ici. */
  async goLive(id: string, recruiterId: string) {
    const offer = await this.requireOffer(id);
    this.requireOwner(offer, recruiterId);

    if (offer.status !== JobStatus.APPROVED)
      throw new RpcException({
        statusCode: 400,
        message: "Seules les offres approuvées peuvent être publiées.",
      });

    const plan = await this.getCompanyPlan(offer.companyId);
    if (plan !== PlanType.PRO) {
      const activeCount = await retry(() =>
        this.prisma.jobOffer.count({
          where: { companyId: offer.companyId, status: JobStatus.PUBLISHED },
        }),
      );
      if (activeCount >= FREE_PLAN_LIMIT)
        throw new RpcException({
          statusCode: 402,
          message: `Quota atteint : ${FREE_PLAN_LIMIT} offres actives maximum (plan Free). Passez au plan Pro pour publier davantage.`,
        });
    }

    const [published] = await this.prisma.$transaction([
      this.prisma.jobOffer.update({
        where: { id },
        data: { status: JobStatus.PUBLISHED, publishedAt: new Date() },
      }),
      this.emitEvent(Events.JOB_PUBLISHED, {
        jobOfferId: id,
        companyId: offer.companyId,
      }),
      this.writeHistoryEvent(id, JobStatus.PUBLISHED, "RECRUITER", recruiterId),
    ]);
    return published;
  }

  async reject(id: string, reason: string | undefined, adminId: string) {
    const offer = await this.requireOffer(id);
    if (offer.status !== JobStatus.PENDING_REVIEW)
      throw new RpcException({
        statusCode: 400,
        message: "Seules les offres en attente peuvent être rejetées.",
      });

    const [rejected] = await this.prisma.$transaction([
      this.prisma.jobOffer.update({
        where: { id },
        data: { status: JobStatus.REJECTED, rejectionReason: reason ?? null },
      }),
      this.writeHistoryEvent(
        id,
        JobStatus.REJECTED,
        "ADMIN",
        adminId,
        reason ?? null,
      ),
    ]);
    return rejected;
  }

  async resetToDraft(id: string, recruiterId: string) {
    const offer = await this.requireOffer(id);
    this.requireOwner(offer, recruiterId);
    if (offer.status !== JobStatus.REJECTED)
      throw new RpcException({
        statusCode: 400,
        message:
          "Seules les offres rejetées peuvent être repassées en brouillon.",
      });

    const [draft] = await this.prisma.$transaction([
      this.prisma.jobOffer.update({
        where: { id },
        data: { status: JobStatus.DRAFT, rejectionReason: null },
      }),
      this.writeHistoryEvent(id, JobStatus.DRAFT, "RECRUITER", recruiterId),
    ]);
    return draft;
  }

  async getHistory(id: string, requesterId: string, isAdmin: boolean) {
    const offer = await this.requireOffer(id);
    if (!isAdmin) this.requireOwner(offer, requesterId);
    return retry(() =>
      this.prisma.jobOfferEvent.findMany({
        where: { jobOfferId: id },
        orderBy: { createdAt: "asc" },
      }),
    );
  }

  // Vue admin complète (toutes offres, tous statuts) — distincte de
  // findPendingReview qui ne sert que l'onglet "Modération".
  async findAllForAdmin(
    page: number,
    pageSize: number,
    status?: JobStatus,
    search?: string,
  ) {
    const where: Record<string, unknown> = {};
    if (status) where["status"] = status;
    if (search) {
      where["OR"] = [
        { title: { contains: search, mode: "insensitive" } },
        { companyName: { contains: search, mode: "insensitive" } },
      ];
    }
    const skip = (page - 1) * pageSize;
    const [data, total] = await Promise.all([
      retry(() =>
        this.prisma.jobOffer.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip,
          take: pageSize,
        }),
      ),
      retry(() => this.prisma.jobOffer.count({ where })),
    ]);
    return { data, total, page, pageSize };
  }

  async findPendingReview(page: number, pageSize: number) {
    const skip = (page - 1) * pageSize;
    const [data, total] = await Promise.all([
      retry(() =>
        this.prisma.jobOffer.findMany({
          where: { status: JobStatus.PENDING_REVIEW },
          orderBy: { updatedAt: "asc" },
          skip,
          take: pageSize,
        }),
      ),
      retry(() =>
        this.prisma.jobOffer.count({
          where: { status: JobStatus.PENDING_REVIEW },
        }),
      ),
    ]);
    return { data, total, page, pageSize };
  }

  async getStats() {
    const [total, grouped] = await Promise.all([
      retry(() => this.prisma.jobOffer.count()),
      retry(() =>
        this.prisma.jobOffer.groupBy({
          by: ["status"],
          _count: { status: true },
        }),
      ),
    ]);
    const byStatus = Object.fromEntries(
      grouped.map((g) => [g.status, g._count.status]),
    ) as Partial<Record<JobStatus, number>>;
    return {
      total,
      draft: byStatus[JobStatus.DRAFT] ?? 0,
      pendingReview: byStatus[JobStatus.PENDING_REVIEW] ?? 0,
      approved: byStatus[JobStatus.APPROVED] ?? 0,
      published: byStatus[JobStatus.PUBLISHED] ?? 0,
      rejected: byStatus[JobStatus.REJECTED] ?? 0,
      archived: byStatus[JobStatus.ARCHIVED] ?? 0,
    };
  }

  async delete(id: string, recruiterId: string, isAdmin = false) {
    const offer = await this.requireOffer(id);
    this.requireOwnerUnlessAdmin(offer, recruiterId, isAdmin);
    if (offer.status === "PUBLISHED") {
      throw new RpcException({
        statusCode: 400,
        message:
          "Une offre publiée ne peut pas être supprimée. Archivez-la d'abord.",
      });
    }
    if (await this.hasActiveApplications(id))
      throw new RpcException({
        statusCode: 400,
        message:
          "Impossible de supprimer cette offre : des candidatures sont encore en cours.",
      });
    await this.prisma.jobOffer.delete({ where: { id } });
    return { ok: true };
  }

  async archive(id: string, recruiterId: string, isAdmin = false) {
    const offer = await this.requireOffer(id);
    this.requireOwnerUnlessAdmin(offer, recruiterId, isAdmin);

    if (offer.status === JobStatus.ARCHIVED)
      throw new RpcException({
        statusCode: 400,
        message: "Cette offre est déjà archivée",
      });

    if (await this.hasActiveApplications(id))
      throw new RpcException({
        statusCode: 400,
        message:
          "Impossible d'archiver cette offre : des candidatures sont encore en cours.",
      });

    const [archived] = await this.prisma.$transaction([
      this.prisma.jobOffer.update({
        where: { id },
        data: { status: JobStatus.ARCHIVED },
      }),
      this.emitEvent(Events.JOB_ARCHIVED, {
        jobOfferId: id,
        recruiterId,
        companyId: offer.companyId,
      }),
      this.writeHistoryEvent(
        id,
        JobStatus.ARCHIVED,
        isAdmin ? "ADMIN" : "RECRUITER",
        recruiterId,
      ),
    ]);
    return archived;
  }

  /** Annule un archivage (erreur du recruteur) : repasse en brouillon, à resoumettre pour publication. */
  async unarchive(id: string, recruiterId: string) {
    const offer = await this.requireOffer(id);
    this.requireOwner(offer, recruiterId);

    if (offer.status !== JobStatus.ARCHIVED)
      throw new RpcException({
        statusCode: 400,
        message: "Seules les offres archivées peuvent être désarchivées.",
      });

    const [draft] = await this.prisma.$transaction([
      this.prisma.jobOffer.update({
        where: { id },
        data: { status: JobStatus.DRAFT },
      }),
      this.writeHistoryEvent(id, JobStatus.DRAFT, "RECRUITER", recruiterId),
    ]);
    return draft;
  }

  /**
   * Consumer de l'event user.deleted (RGPD, CLAUDE.md §25/§28) : un recruteur
   * a supprimé son compte (chez auth-service) — on dépublie ses offres encore
   * actives plutôt que de les supprimer, pour préserver l'historique des
   * candidatures déjà reçues côté applications-svc.
   */
  async archiveAllForDeletedRecruiter(recruiterId: string) {
    const offers = await this.prisma.jobOffer.findMany({
      where: { recruiterId, status: { not: JobStatus.ARCHIVED } },
      select: { id: true, companyId: true },
    });
    if (offers.length === 0) return { archived: 0 };

    await this.prisma.$transaction([
      this.prisma.jobOffer.updateMany({
        where: { id: { in: offers.map((o) => o.id) } },
        data: { status: JobStatus.ARCHIVED },
      }),
      this.prisma.jobOfferEvent.createMany({
        data: offers.map((o) => ({
          jobOfferId: o.id,
          status: JobStatus.ARCHIVED,
          actorRole: "SYSTEM",
          actorId: null,
          note: "Archivée automatiquement : le compte du recruteur a été supprimé.",
        })),
      }),
    ]);
    return { archived: offers.length };
  }
}
