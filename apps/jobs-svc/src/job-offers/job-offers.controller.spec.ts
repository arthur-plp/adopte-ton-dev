import { Test, TestingModule } from "@nestjs/testing";
import { JobOffersController } from "./job-offers.controller";
import { JobOffersService } from "./job-offers.service";
import { JobStatus, JobType } from "@repo/types";

const mockService = {
  create: jest.fn(),
  findMine: jest.fn(),
  findOne: jest.fn(),
  findPublished: jest.fn(),
  update: jest.fn(),
  publish: jest.fn(),
  archive: jest.fn(),
  unarchive: jest.fn(),
  goLive: jest.fn(),
  approve: jest.fn(),
  reject: jest.fn(),
  resetToDraft: jest.fn(),
  findPendingReview: jest.fn(),
  getHistory: jest.fn(),
};

const baseOffer = {
  id: "job-1",
  companyId: "company-1",
  recruiterId: "recruiter-1",
  title: "Dev TS",
  description: "Description du poste",
  type: JobType.INTERNSHIP,
  status: JobStatus.DRAFT,
  isPublic: true,
  location: null,
  remoteOk: false,
  requiredTechnologies: [],
  salaryMin: null,
  salaryMax: null,
  createdAt: new Date(),
  publishedAt: null,
  updatedAt: new Date(),
};

describe("JobOffersController", () => {
  let controller: JobOffersController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [JobOffersController],
      providers: [{ provide: JobOffersService, useValue: mockService }],
    }).compile();
    controller = module.get<JobOffersController>(JobOffersController);
    jest.clearAllMocks();
  });

  it("create → délègue au service", async () => {
    mockService.create.mockResolvedValueOnce(baseOffer);
    const result = await controller.create({
      recruiterId: "recruiter-1",
      companyId: "company-1",
      dto: {
        title: "Dev TS",
        description: "Description du poste",
        type: JobType.INTERNSHIP,
        remoteOk: false,
        requiredTechnologies: [],
        isPublic: true,
      },
    });
    expect(result).toEqual(baseOffer);
    expect(mockService.create).toHaveBeenCalledWith(
      "recruiter-1",
      "company-1",
      expect.any(Object),
      undefined,
    );
  });

  it("findMine → filtre par recruiterId", async () => {
    mockService.findMine.mockResolvedValueOnce([baseOffer]);
    const result = await controller.findMine({ recruiterId: "recruiter-1" });
    expect(result).toHaveLength(1);
  });

  it("findOne → retourne l'offre", async () => {
    mockService.findOne.mockResolvedValueOnce(baseOffer);
    const result = await controller.findOne({ id: "job-1" });
    expect(result.id).toBe("job-1");
  });

  it("findPublished → retourne liste paginée", async () => {
    const paginated = { data: [baseOffer], total: 1, page: 1, pageSize: 20 };
    mockService.findPublished.mockResolvedValueOnce(paginated);
    const result = await controller.findPublished({
      filters: {},
      page: 1,
      pageSize: 20,
    });
    expect(result.total).toBe(1);
  });

  it("update → délègue au service", async () => {
    mockService.update.mockResolvedValueOnce({
      ...baseOffer,
      title: "Nouveau",
    });
    const result = await controller.update({
      id: "job-1",
      recruiterId: "recruiter-1",
      dto: { title: "Nouveau" },
    });
    expect(result.title).toBe("Nouveau");
  });

  it("publish → délègue au service", async () => {
    mockService.publish.mockResolvedValueOnce({
      ...baseOffer,
      status: JobStatus.PUBLISHED,
    });
    const result = await controller.publish({
      id: "job-1",
      recruiterId: "recruiter-1",
    });
    expect(result.status).toBe(JobStatus.PUBLISHED);
  });

  it("archive → délègue au service", async () => {
    mockService.archive.mockResolvedValueOnce({
      ...baseOffer,
      status: JobStatus.ARCHIVED,
    });
    const result = await controller.archive({
      id: "job-1",
      recruiterId: "recruiter-1",
    });
    expect(result.status).toBe(JobStatus.ARCHIVED);
  });

  it("unarchive → délègue au service", async () => {
    mockService.unarchive.mockResolvedValueOnce({
      ...baseOffer,
      status: JobStatus.DRAFT,
    });
    const result = await controller.unarchive({
      id: "job-1",
      recruiterId: "recruiter-1",
    });
    expect(result.status).toBe(JobStatus.DRAFT);
    expect(mockService.unarchive).toHaveBeenCalledWith("job-1", "recruiter-1");
  });

  it("goLive → délègue au service", async () => {
    mockService.goLive.mockResolvedValueOnce({
      ...baseOffer,
      status: JobStatus.PUBLISHED,
    });
    const result = await controller.goLive({
      id: "job-1",
      recruiterId: "recruiter-1",
    });
    expect(result.status).toBe(JobStatus.PUBLISHED);
    expect(mockService.goLive).toHaveBeenCalledWith("job-1", "recruiter-1");
  });

  it("approve → délègue id et adminId au service", async () => {
    mockService.approve.mockResolvedValueOnce({
      ...baseOffer,
      status: JobStatus.PUBLISHED,
    });
    const result = await controller.approve({
      id: "job-1",
      adminId: "admin-1",
    });
    expect(result.status).toBe(JobStatus.PUBLISHED);
    expect(mockService.approve).toHaveBeenCalledWith("job-1", "admin-1");
  });

  it("reject → délègue id, reason et adminId au service", async () => {
    mockService.reject.mockResolvedValueOnce({
      ...baseOffer,
      status: JobStatus.REJECTED,
    });
    const result = await controller.reject({
      id: "job-1",
      reason: "Incomplet",
      adminId: "admin-1",
    });
    expect(result.status).toBe(JobStatus.REJECTED);
    expect(mockService.reject).toHaveBeenCalledWith(
      "job-1",
      "Incomplet",
      "admin-1",
    );
  });

  it("resetToDraft → délègue au service", async () => {
    mockService.resetToDraft.mockResolvedValueOnce({
      ...baseOffer,
      status: JobStatus.DRAFT,
    });
    const result = await controller.resetToDraft({
      id: "job-1",
      recruiterId: "recruiter-1",
    });
    expect(result.status).toBe(JobStatus.DRAFT);
  });

  it("findPendingReview → délègue page et pageSize au service", async () => {
    const paginated = { data: [baseOffer], total: 1, page: 1, pageSize: 10 };
    mockService.findPendingReview.mockResolvedValueOnce(paginated);
    const result = await controller.findPendingReview({
      page: 1,
      pageSize: 10,
    });
    expect(result.total).toBe(1);
  });

  it("getHistory → délègue id, requesterId et isAdmin au service", async () => {
    mockService.getHistory.mockResolvedValueOnce([]);
    await controller.getHistory({
      id: "job-1",
      requesterId: "admin-1",
      isAdmin: true,
    });
    expect(mockService.getHistory).toHaveBeenCalledWith(
      "job-1",
      "admin-1",
      true,
    );
  });
});
