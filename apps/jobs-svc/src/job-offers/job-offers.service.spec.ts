import { Test, TestingModule } from "@nestjs/testing";
import { RpcException } from "@nestjs/microservices";
import { JobOffersService } from "./job-offers.service";
import { PrismaService } from "../prisma/prisma.service";
import { JobStatus, JobType } from "@repo/types";

const FREE_PLAN_LIMIT = 2;

const mockPrisma = {
  jobOffer: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
    delete: jest.fn(),
  },
  jobOfferEvent: {
    create: jest.fn(),
    findMany: jest.fn(),
  },
  outboxEvent: { create: jest.fn() },
  $transaction: jest.fn(),
};

const baseOffer = {
  id: "job-1",
  companyId: "company-1",
  recruiterId: "recruiter-1",
  title: "Développeur TS",
  description: "Description du poste de développeur",
  type: JobType.INTERNSHIP,
  status: JobStatus.DRAFT,
  isPublic: true,
  location: null,
  remoteOk: false,
  requiredTechnologies: ["TypeScript"],
  salaryMin: null,
  salaryMax: null,
  createdAt: new Date(),
  publishedAt: null,
  updatedAt: new Date(),
};

describe("JobOffersService", () => {
  let service: JobOffersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JobOffersService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get<JobOffersService>(JobOffersService);
    jest.clearAllMocks();
  });

  // ── create ─────────────────────────────────────────────────────────────────

  describe("create", () => {
    beforeEach(() => {
      mockPrisma.$transaction.mockImplementation(
        (callback: (tx: typeof mockPrisma) => Promise<unknown>) =>
          callback(mockPrisma),
      );
    });

    it("crée une offre en statut DRAFT", async () => {
      mockPrisma.jobOffer.create.mockResolvedValueOnce({
        ...baseOffer,
        id: "new-job",
      });
      const result = await service.create("recruiter-1", "company-1", {
        title: "Développeur TS",
        description: "Description du poste de développeur",
        type: JobType.INTERNSHIP,
        remoteOk: false,
        requiredTechnologies: [],
        isPublic: true,
      });
      expect(result.id).toBe("new-job");
      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    });

    it("écrit un JobOfferEvent DRAFT avec actorRole RECRUITER", async () => {
      mockPrisma.jobOffer.create.mockResolvedValueOnce({
        ...baseOffer,
        id: "new-job",
      });
      await service.create("recruiter-1", "company-1", {
        title: "Développeur TS",
        description: "Description du poste de développeur",
        type: JobType.INTERNSHIP,
        remoteOk: false,
        requiredTechnologies: [],
        isPublic: true,
      });
      expect(mockPrisma.jobOfferEvent.create).toHaveBeenCalledWith({
        data: {
          jobOfferId: "new-job",
          status: JobStatus.DRAFT,
          actorRole: "RECRUITER",
          actorId: "recruiter-1",
          note: null,
        },
      });
    });
  });

  // ── findMine ───────────────────────────────────────────────────────────────

  describe("findMine", () => {
    it("retourne les offres du recruteur triées par date", async () => {
      mockPrisma.jobOffer.findMany.mockResolvedValueOnce([baseOffer]);
      const result = await service.findMine("recruiter-1");
      expect(result).toHaveLength(1);
      expect(mockPrisma.jobOffer.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { recruiterId: "recruiter-1" } }),
      );
    });
  });

  // ── findOne ────────────────────────────────────────────────────────────────

  describe("findOne", () => {
    it("retourne l'offre si elle existe", async () => {
      mockPrisma.jobOffer.findUnique.mockResolvedValueOnce(baseOffer);
      const result = await service.findOne("job-1");
      expect(result.id).toBe("job-1");
    });

    it("lance une RpcException 404 si introuvable", async () => {
      mockPrisma.jobOffer.findUnique.mockResolvedValueOnce(null);
      await expect(service.findOne("unknown")).rejects.toThrow(RpcException);
    });
  });

  // ── findPublished ──────────────────────────────────────────────────────────

  describe("findPublished", () => {
    it("filtre par status PUBLISHED et isPublic true", async () => {
      mockPrisma.jobOffer.findMany.mockResolvedValueOnce([]);
      mockPrisma.jobOffer.count.mockResolvedValueOnce(0);
      await service.findPublished({}, 1, 20);
      expect(mockPrisma.jobOffer.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: JobStatus.PUBLISHED,
            isPublic: true,
          }),
        }),
      );
    });

    it("retourne une réponse paginée", async () => {
      mockPrisma.jobOffer.findMany.mockResolvedValueOnce([baseOffer]);
      mockPrisma.jobOffer.count.mockResolvedValueOnce(5);
      const result = await service.findPublished({}, 1, 20);
      expect(result.total).toBe(5);
      expect(result.data).toHaveLength(1);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(20);
    });
  });

  // ── update ─────────────────────────────────────────────────────────────────

  describe("update", () => {
    it("met à jour si le recruteur est propriétaire", async () => {
      mockPrisma.jobOffer.findUnique.mockResolvedValueOnce(baseOffer);
      const updated = { ...baseOffer, title: "Nouveau titre" };
      mockPrisma.$transaction.mockResolvedValueOnce([updated]);
      const result = await service.update("job-1", "recruiter-1", {
        title: "Nouveau titre",
      });
      expect(result.title).toBe("Nouveau titre");
    });

    it("lance RpcException 403 si pas propriétaire", async () => {
      mockPrisma.jobOffer.findUnique.mockResolvedValueOnce(baseOffer);
      await expect(
        service.update("job-1", "autre-recruteur", { title: "x" }),
      ).rejects.toThrow(RpcException);
    });

    it("lance RpcException 404 si offre introuvable", async () => {
      mockPrisma.jobOffer.findUnique.mockResolvedValueOnce(null);
      await expect(
        service.update("unknown", "recruiter-1", { title: "x" }),
      ).rejects.toThrow(RpcException);
    });

    it("lance RpcException 400 si offre PUBLISHED (archiver pour modifier)", async () => {
      mockPrisma.jobOffer.findUnique.mockResolvedValueOnce({
        ...baseOffer,
        status: JobStatus.PUBLISHED,
      });
      await expect(
        service.update("job-1", "recruiter-1", { title: "x" }),
      ).rejects.toThrow(RpcException);
    });
  });

  // ── publish ────────────────────────────────────────────────────────────────

  describe("publish", () => {
    it("soumet une offre DRAFT en PENDING_REVIEW", async () => {
      mockPrisma.jobOffer.findUnique.mockResolvedValueOnce(baseOffer);
      const submitted = { ...baseOffer, status: JobStatus.PENDING_REVIEW };
      mockPrisma.$transaction.mockResolvedValueOnce([submitted]);
      const result = await service.publish("job-1", "recruiter-1");
      expect(result.status).toBe(JobStatus.PENDING_REVIEW);
    });

    it("écrit un JobOfferEvent PENDING_REVIEW avec actorRole RECRUITER", async () => {
      mockPrisma.jobOffer.findUnique.mockResolvedValueOnce(baseOffer);
      mockPrisma.$transaction.mockImplementationOnce((ops: unknown) =>
        Promise.all(ops as Promise<unknown>[]),
      );
      await service.publish("job-1", "recruiter-1");
      expect(mockPrisma.jobOfferEvent.create).toHaveBeenCalledWith({
        data: {
          jobOfferId: "job-1",
          status: JobStatus.PENDING_REVIEW,
          actorRole: "RECRUITER",
          actorId: "recruiter-1",
          note: null,
        },
      });
    });

    it("lance RpcException 403 si pas propriétaire", async () => {
      mockPrisma.jobOffer.findUnique.mockResolvedValueOnce(baseOffer);
      await expect(service.publish("job-1", "autre")).rejects.toThrow(
        RpcException,
      );
    });

    it("lance RpcException 400 si déjà publié", async () => {
      mockPrisma.jobOffer.findUnique.mockResolvedValueOnce({
        ...baseOffer,
        status: JobStatus.PUBLISHED,
      });
      await expect(service.publish("job-1", "recruiter-1")).rejects.toThrow(
        RpcException,
      );
    });
  });

  // ── goLive ─────────────────────────────────────────────────────────────────

  describe("goLive", () => {
    it("publie une offre APPROVED si propriétaire et quota disponible", async () => {
      const approved = { ...baseOffer, status: JobStatus.APPROVED };
      mockPrisma.jobOffer.findUnique.mockResolvedValueOnce(approved);
      mockPrisma.jobOffer.count.mockResolvedValueOnce(0);
      const published = {
        ...approved,
        status: JobStatus.PUBLISHED,
        publishedAt: new Date(),
      };
      mockPrisma.$transaction.mockResolvedValueOnce([published]);
      const result = await service.goLive("job-1", "recruiter-1");
      expect(result.status).toBe(JobStatus.PUBLISHED);
    });

    it("écrit un JobOfferEvent PUBLISHED avec actorRole RECRUITER", async () => {
      const approved = { ...baseOffer, status: JobStatus.APPROVED };
      mockPrisma.jobOffer.findUnique.mockResolvedValueOnce(approved);
      mockPrisma.jobOffer.count.mockResolvedValueOnce(0);
      mockPrisma.$transaction.mockImplementationOnce((ops: unknown) =>
        Promise.all(ops as Promise<unknown>[]),
      );
      await service.goLive("job-1", "recruiter-1");
      expect(mockPrisma.jobOfferEvent.create).toHaveBeenCalledWith({
        data: {
          jobOfferId: "job-1",
          status: JobStatus.PUBLISHED,
          actorRole: "RECRUITER",
          actorId: "recruiter-1",
          note: null,
        },
      });
    });

    it("lance RpcException 403 si pas propriétaire", async () => {
      const approved = { ...baseOffer, status: JobStatus.APPROVED };
      mockPrisma.jobOffer.findUnique.mockResolvedValueOnce(approved);
      await expect(service.goLive("job-1", "autre")).rejects.toThrow(
        RpcException,
      );
    });

    it("lance RpcException 400 si offre pas APPROVED", async () => {
      mockPrisma.jobOffer.findUnique.mockResolvedValueOnce(baseOffer);
      await expect(service.goLive("job-1", "recruiter-1")).rejects.toThrow(
        RpcException,
      );
    });

    it(`lance RpcException 402 si quota Free (${FREE_PLAN_LIMIT} offres actives) atteint`, async () => {
      const approved = { ...baseOffer, status: JobStatus.APPROVED };
      mockPrisma.jobOffer.findUnique.mockResolvedValueOnce(approved);
      mockPrisma.jobOffer.count.mockResolvedValueOnce(FREE_PLAN_LIMIT);
      await expect(service.goLive("job-1", "recruiter-1")).rejects.toThrow(
        RpcException,
      );
    });
  });

  // ── unarchive ──────────────────────────────────────────────────────────────

  describe("unarchive", () => {
    it("repasse une offre ARCHIVED en DRAFT si propriétaire", async () => {
      const archived = { ...baseOffer, status: JobStatus.ARCHIVED };
      mockPrisma.jobOffer.findUnique.mockResolvedValueOnce(archived);
      const draft = { ...archived, status: JobStatus.DRAFT };
      mockPrisma.$transaction.mockResolvedValueOnce([draft]);
      const result = await service.unarchive("job-1", "recruiter-1");
      expect(result.status).toBe(JobStatus.DRAFT);
    });

    it("écrit un JobOfferEvent DRAFT avec actorRole RECRUITER", async () => {
      const archived = { ...baseOffer, status: JobStatus.ARCHIVED };
      mockPrisma.jobOffer.findUnique.mockResolvedValueOnce(archived);
      mockPrisma.$transaction.mockImplementationOnce((ops: unknown) =>
        Promise.all(ops as Promise<unknown>[]),
      );
      await service.unarchive("job-1", "recruiter-1");
      expect(mockPrisma.jobOfferEvent.create).toHaveBeenCalledWith({
        data: {
          jobOfferId: "job-1",
          status: JobStatus.DRAFT,
          actorRole: "RECRUITER",
          actorId: "recruiter-1",
          note: null,
        },
      });
    });

    it("lance RpcException 403 si pas propriétaire", async () => {
      const archived = { ...baseOffer, status: JobStatus.ARCHIVED };
      mockPrisma.jobOffer.findUnique.mockResolvedValueOnce(archived);
      await expect(service.unarchive("job-1", "autre")).rejects.toThrow(
        RpcException,
      );
    });

    it("lance RpcException 400 si offre pas ARCHIVED", async () => {
      mockPrisma.jobOffer.findUnique.mockResolvedValueOnce(baseOffer);
      await expect(service.unarchive("job-1", "recruiter-1")).rejects.toThrow(
        RpcException,
      );
    });
  });

  // ── delete ─────────────────────────────────────────────────────────────────

  describe("delete", () => {
    it("supprime une offre DRAFT si propriétaire", async () => {
      mockPrisma.jobOffer.findUnique.mockResolvedValueOnce(baseOffer);
      mockPrisma.jobOffer.delete.mockResolvedValueOnce(baseOffer);
      const result = await service.delete("job-1", "recruiter-1");
      expect(result).toEqual({ ok: true });
      expect(mockPrisma.jobOffer.delete).toHaveBeenCalledWith({
        where: { id: "job-1" },
      });
    });

    it("supprime une offre ARCHIVED si propriétaire", async () => {
      mockPrisma.jobOffer.findUnique.mockResolvedValueOnce({
        ...baseOffer,
        status: JobStatus.ARCHIVED,
      });
      mockPrisma.jobOffer.delete.mockResolvedValueOnce(baseOffer);
      const result = await service.delete("job-1", "recruiter-1");
      expect(result).toEqual({ ok: true });
    });

    it("lance RpcException 400 si offre PUBLISHED", async () => {
      mockPrisma.jobOffer.findUnique.mockResolvedValueOnce({
        ...baseOffer,
        status: JobStatus.PUBLISHED,
      });
      await expect(service.delete("job-1", "recruiter-1")).rejects.toThrow(
        RpcException,
      );
    });

    it("lance RpcException 403 si pas propriétaire", async () => {
      mockPrisma.jobOffer.findUnique.mockResolvedValueOnce(baseOffer);
      await expect(service.delete("job-1", "autre")).rejects.toThrow(
        RpcException,
      );
    });

    it("lance RpcException 404 si offre introuvable", async () => {
      mockPrisma.jobOffer.findUnique.mockResolvedValueOnce(null);
      await expect(service.delete("unknown", "recruiter-1")).rejects.toThrow(
        RpcException,
      );
    });
  });

  // ── archive ────────────────────────────────────────────────────────────────

  describe("archive", () => {
    it("archive une offre PUBLISHED", async () => {
      const publishedOffer = { ...baseOffer, status: JobStatus.PUBLISHED };
      mockPrisma.jobOffer.findUnique.mockResolvedValueOnce(publishedOffer);
      const archived = { ...publishedOffer, status: JobStatus.ARCHIVED };
      mockPrisma.$transaction.mockResolvedValueOnce([archived]);
      const result = await service.archive("job-1", "recruiter-1");
      expect(result.status).toBe(JobStatus.ARCHIVED);
    });

    it("archive une offre DRAFT", async () => {
      mockPrisma.jobOffer.findUnique.mockResolvedValueOnce(baseOffer);
      const archived = { ...baseOffer, status: JobStatus.ARCHIVED };
      mockPrisma.$transaction.mockResolvedValueOnce([archived]);
      const result = await service.archive("job-1", "recruiter-1");
      expect(result.status).toBe(JobStatus.ARCHIVED);
    });

    it("lance RpcException 403 si pas propriétaire", async () => {
      mockPrisma.jobOffer.findUnique.mockResolvedValueOnce(baseOffer);
      await expect(service.archive("job-1", "autre")).rejects.toThrow(
        RpcException,
      );
    });

    it("lance RpcException 400 si déjà archivée", async () => {
      mockPrisma.jobOffer.findUnique.mockResolvedValueOnce({
        ...baseOffer,
        status: JobStatus.ARCHIVED,
      });
      await expect(service.archive("job-1", "recruiter-1")).rejects.toThrow(
        RpcException,
      );
    });

    it("écrit un JobOfferEvent ARCHIVED avec actorRole RECRUITER", async () => {
      const publishedOffer = { ...baseOffer, status: JobStatus.PUBLISHED };
      mockPrisma.jobOffer.findUnique.mockResolvedValueOnce(publishedOffer);
      mockPrisma.$transaction.mockImplementationOnce((ops: unknown) =>
        Promise.all(ops as Promise<unknown>[]),
      );
      await service.archive("job-1", "recruiter-1");
      expect(mockPrisma.jobOfferEvent.create).toHaveBeenCalledWith({
        data: {
          jobOfferId: "job-1",
          status: JobStatus.ARCHIVED,
          actorRole: "RECRUITER",
          actorId: "recruiter-1",
          note: null,
        },
      });
    });
  });

  // ── approve ────────────────────────────────────────────────────────────────

  describe("approve", () => {
    it("approuve une offre PENDING_REVIEW sans la publier (statut APPROVED)", async () => {
      const pending = { ...baseOffer, status: JobStatus.PENDING_REVIEW };
      mockPrisma.jobOffer.findUnique.mockResolvedValueOnce(pending);
      const approved = { ...pending, status: JobStatus.APPROVED };
      mockPrisma.$transaction.mockResolvedValueOnce([approved]);
      const result = await service.approve("job-1", "admin-1");
      expect(result.status).toBe(JobStatus.APPROVED);
    });

    it("écrit un JobOfferEvent APPROVED avec actorRole ADMIN", async () => {
      const pending = { ...baseOffer, status: JobStatus.PENDING_REVIEW };
      mockPrisma.jobOffer.findUnique.mockResolvedValueOnce(pending);
      mockPrisma.$transaction.mockImplementationOnce((ops: unknown) =>
        Promise.all(ops as Promise<unknown>[]),
      );
      await service.approve("job-1", "admin-1");
      expect(mockPrisma.jobOfferEvent.create).toHaveBeenCalledWith({
        data: {
          jobOfferId: "job-1",
          status: JobStatus.APPROVED,
          actorRole: "ADMIN",
          actorId: "admin-1",
          note: null,
        },
      });
    });

    it("lance RpcException 400 si offre pas en PENDING_REVIEW", async () => {
      mockPrisma.jobOffer.findUnique.mockResolvedValueOnce(baseOffer);
      await expect(service.approve("job-1", "admin-1")).rejects.toThrow(
        RpcException,
      );
    });

    it("lance RpcException 404 si offre introuvable", async () => {
      mockPrisma.jobOffer.findUnique.mockResolvedValueOnce(null);
      await expect(service.approve("unknown", "admin-1")).rejects.toThrow(
        RpcException,
      );
    });
  });

  // ── reject ─────────────────────────────────────────────────────────────────

  describe("reject", () => {
    beforeEach(() => {
      mockPrisma.$transaction.mockImplementation((ops: unknown) =>
        Promise.all(ops as Promise<unknown>[]),
      );
    });

    it("rejette une offre PENDING_REVIEW avec un motif", async () => {
      const pending = { ...baseOffer, status: JobStatus.PENDING_REVIEW };
      mockPrisma.jobOffer.findUnique.mockResolvedValueOnce(pending);
      const rejected = {
        ...pending,
        status: JobStatus.REJECTED,
        rejectionReason: "Incomplet",
      };
      mockPrisma.jobOffer.update.mockResolvedValueOnce(rejected);
      const result = await service.reject("job-1", "Incomplet", "admin-1");
      expect(result.status).toBe(JobStatus.REJECTED);
    });

    it("écrit un JobOfferEvent REJECTED avec le motif en note et actorRole ADMIN", async () => {
      const pending = { ...baseOffer, status: JobStatus.PENDING_REVIEW };
      mockPrisma.jobOffer.findUnique.mockResolvedValueOnce(pending);
      await service.reject("job-1", "Incomplet", "admin-1");
      expect(mockPrisma.jobOfferEvent.create).toHaveBeenCalledWith({
        data: {
          jobOfferId: "job-1",
          status: JobStatus.REJECTED,
          actorRole: "ADMIN",
          actorId: "admin-1",
          note: "Incomplet",
        },
      });
    });

    it("lance RpcException 400 si offre pas en PENDING_REVIEW", async () => {
      mockPrisma.jobOffer.findUnique.mockResolvedValueOnce(baseOffer);
      await expect(
        service.reject("job-1", undefined, "admin-1"),
      ).rejects.toThrow(RpcException);
    });
  });

  // ── resetToDraft ──────────────────────────────────────────────────────────

  describe("resetToDraft", () => {
    beforeEach(() => {
      mockPrisma.$transaction.mockImplementation((ops: unknown) =>
        Promise.all(ops as Promise<unknown>[]),
      );
    });

    it("repasse une offre REJECTED en DRAFT si propriétaire", async () => {
      const rejected = { ...baseOffer, status: JobStatus.REJECTED };
      mockPrisma.jobOffer.findUnique.mockResolvedValueOnce(rejected);
      const draft = {
        ...rejected,
        status: JobStatus.DRAFT,
        rejectionReason: null,
      };
      mockPrisma.jobOffer.update.mockResolvedValueOnce(draft);
      const result = await service.resetToDraft("job-1", "recruiter-1");
      expect(result.status).toBe(JobStatus.DRAFT);
    });

    it("écrit un JobOfferEvent DRAFT avec actorRole RECRUITER", async () => {
      const rejected = { ...baseOffer, status: JobStatus.REJECTED };
      mockPrisma.jobOffer.findUnique.mockResolvedValueOnce(rejected);
      await service.resetToDraft("job-1", "recruiter-1");
      expect(mockPrisma.jobOfferEvent.create).toHaveBeenCalledWith({
        data: {
          jobOfferId: "job-1",
          status: JobStatus.DRAFT,
          actorRole: "RECRUITER",
          actorId: "recruiter-1",
          note: null,
        },
      });
    });

    it("lance RpcException 400 si offre pas REJECTED", async () => {
      mockPrisma.jobOffer.findUnique.mockResolvedValueOnce(baseOffer);
      await expect(
        service.resetToDraft("job-1", "recruiter-1"),
      ).rejects.toThrow(RpcException);
    });

    it("lance RpcException 403 si pas propriétaire", async () => {
      const rejected = { ...baseOffer, status: JobStatus.REJECTED };
      mockPrisma.jobOffer.findUnique.mockResolvedValueOnce(rejected);
      await expect(service.resetToDraft("job-1", "autre")).rejects.toThrow(
        RpcException,
      );
    });
  });

  // ── findPendingReview ─────────────────────────────────────────────────────

  describe("findPendingReview", () => {
    it("retourne les offres PENDING_REVIEW paginées", async () => {
      const pending = { ...baseOffer, status: JobStatus.PENDING_REVIEW };
      mockPrisma.jobOffer.findMany.mockResolvedValueOnce([pending]);
      mockPrisma.jobOffer.count.mockResolvedValueOnce(1);
      const result = await service.findPendingReview(1, 10);
      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
    });
  });

  // ── getHistory ────────────────────────────────────────────────────────────

  describe("getHistory", () => {
    const events = [
      {
        id: "evt-1",
        jobOfferId: "job-1",
        status: JobStatus.DRAFT,
        actorRole: "RECRUITER",
        actorId: "recruiter-1",
        note: null,
        createdAt: new Date(),
      },
    ];

    it("retourne l'historique trié si le recruteur est propriétaire", async () => {
      mockPrisma.jobOffer.findUnique.mockResolvedValueOnce(baseOffer);
      mockPrisma.jobOfferEvent.findMany.mockResolvedValueOnce(events);
      const result = await service.getHistory("job-1", "recruiter-1", false);
      expect(result).toEqual(events);
      expect(mockPrisma.jobOfferEvent.findMany).toHaveBeenCalledWith({
        where: { jobOfferId: "job-1" },
        orderBy: { createdAt: "asc" },
      });
    });

    it("retourne l'historique pour un admin sans vérifier l'ownership", async () => {
      mockPrisma.jobOffer.findUnique.mockResolvedValueOnce(baseOffer);
      mockPrisma.jobOfferEvent.findMany.mockResolvedValueOnce(events);
      const result = await service.getHistory("job-1", "admin-1", true);
      expect(result).toEqual(events);
    });

    it("lance RpcException 403 si requesterId n'est pas propriétaire et n'est pas admin", async () => {
      mockPrisma.jobOffer.findUnique.mockResolvedValueOnce(baseOffer);
      await expect(
        service.getHistory("job-1", "autre-recruteur", false),
      ).rejects.toThrow(RpcException);
    });

    it("lance RpcException 404 si offre introuvable", async () => {
      mockPrisma.jobOffer.findUnique.mockResolvedValueOnce(null);
      await expect(
        service.getHistory("unknown", "recruiter-1", false),
      ).rejects.toThrow(RpcException);
    });
  });
});
