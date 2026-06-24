import { Test, TestingModule } from "@nestjs/testing";
import { ApplicationsController } from "./applications.controller";
import { ApplicationsService } from "./applications.service";
import { ApplicationStatus } from "@repo/types";

const mockService = {
  create: jest.fn(),
  findMine: jest.fn(),
  withdraw: jest.fn(),
  reactivate: jest.fn(),
  findByJobOffer: jest.fn(),
  updateStatus: jest.fn(),
  getHistory: jest.fn(),
  hasActiveApplicationsForJobOffer: jest.fn(),
  createDocumentRequest: jest.fn(),
  listDocumentRequests: jest.fn(),
  createUploadUrl: jest.fn(),
  confirmUpload: jest.fn(),
  getDownloadUrl: jest.fn(),
  deleteDocument: jest.fn(),
  getStats: jest.fn(),
};

const baseApplication = {
  id: "app-1",
  jobOfferId: "job-1",
  developerId: "dev-1",
  status: ApplicationStatus.SENT,
  coverLetter: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("ApplicationsController", () => {
  let controller: ApplicationsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ApplicationsController],
      providers: [{ provide: ApplicationsService, useValue: mockService }],
    }).compile();
    controller = module.get<ApplicationsController>(ApplicationsController);
    jest.clearAllMocks();
  });

  it("create → délègue developerId et dto au service", async () => {
    mockService.create.mockResolvedValueOnce(baseApplication);
    const result = await controller.create({
      developerId: "dev-1",
      dto: { jobOfferId: "job-1" },
    });
    expect(result).toEqual(baseApplication);
    expect(mockService.create).toHaveBeenCalledWith("dev-1", {
      jobOfferId: "job-1",
    });
  });

  it("findMine → filtre par developerId", async () => {
    mockService.findMine.mockResolvedValueOnce([baseApplication]);
    const result = await controller.findMine({ developerId: "dev-1" });
    expect(result).toHaveLength(1);
  });

  it("withdraw → délègue id et developerId au service", async () => {
    mockService.withdraw.mockResolvedValueOnce({
      ...baseApplication,
      status: ApplicationStatus.WITHDRAWN,
    });
    const result = await controller.withdraw({
      id: "app-1",
      developerId: "dev-1",
    });
    expect(result.status).toBe(ApplicationStatus.WITHDRAWN);
    expect(mockService.withdraw).toHaveBeenCalledWith("app-1", "dev-1");
  });

  it("reactivate → délègue id et developerId au service", async () => {
    mockService.reactivate.mockResolvedValueOnce({
      ...baseApplication,
      status: ApplicationStatus.SENT,
    });
    const result = await controller.reactivate({
      id: "app-1",
      developerId: "dev-1",
    });
    expect(result.status).toBe(ApplicationStatus.SENT);
    expect(mockService.reactivate).toHaveBeenCalledWith("app-1", "dev-1");
  });

  it("findByJobOffer → délègue jobOfferId et recruiterId au service", async () => {
    mockService.findByJobOffer.mockResolvedValueOnce([baseApplication]);
    const result = await controller.findByJobOffer({
      jobOfferId: "job-1",
      recruiterId: "recruiter-1",
    });
    expect(result).toHaveLength(1);
    expect(mockService.findByJobOffer).toHaveBeenCalledWith(
      "job-1",
      "recruiter-1",
    );
  });

  it("updateStatus → délègue id, recruiterId et dto au service", async () => {
    mockService.updateStatus.mockResolvedValueOnce({
      ...baseApplication,
      status: ApplicationStatus.INTERVIEW,
    });
    const result = await controller.updateStatus({
      id: "app-1",
      recruiterId: "recruiter-1",
      dto: { status: ApplicationStatus.INTERVIEW },
    });
    expect(result.status).toBe(ApplicationStatus.INTERVIEW);
    expect(mockService.updateStatus).toHaveBeenCalledWith(
      "app-1",
      "recruiter-1",
      { status: ApplicationStatus.INTERVIEW },
    );
  });

  it("getHistory → délègue id, requesterId, requesterRole et isAdmin au service", async () => {
    mockService.getHistory.mockResolvedValueOnce([]);
    await controller.getHistory({
      id: "app-1",
      requesterId: "dev-1",
      requesterRole: "DEVELOPER",
      isAdmin: false,
    });
    expect(mockService.getHistory).toHaveBeenCalledWith(
      "app-1",
      "dev-1",
      "DEVELOPER",
      false,
    );
  });

  it("hasActiveForJobOffer → délègue jobOfferId au service", async () => {
    mockService.hasActiveApplicationsForJobOffer.mockResolvedValueOnce({
      hasActive: true,
    });
    const result = await controller.hasActiveForJobOffer({
      jobOfferId: "job-1",
    });
    expect(mockService.hasActiveApplicationsForJobOffer).toHaveBeenCalledWith(
      "job-1",
    );
    expect(result).toEqual({ hasActive: true });
  });

  it("createDocumentRequest → délègue applicationId, requesterId, requesterRole et dto au service", async () => {
    mockService.createDocumentRequest.mockResolvedValueOnce({ id: "req-1" });
    await controller.createDocumentRequest({
      applicationId: "app-1",
      requesterId: "recruiter-1",
      requesterRole: "RECRUITER",
      dto: { label: "CV" },
    });
    expect(mockService.createDocumentRequest).toHaveBeenCalledWith(
      "app-1",
      "recruiter-1",
      "RECRUITER",
      { label: "CV" },
    );
  });

  it("listDocumentRequests → délègue applicationId, requesterId et requesterRole au service", async () => {
    mockService.listDocumentRequests.mockResolvedValueOnce([]);
    await controller.listDocumentRequests({
      applicationId: "app-1",
      requesterId: "dev-1",
      requesterRole: "DEVELOPER",
    });
    expect(mockService.listDocumentRequests).toHaveBeenCalledWith(
      "app-1",
      "dev-1",
      "DEVELOPER",
    );
  });

  it("createUploadUrl → délègue requestId, developerId et dto au service", async () => {
    mockService.createUploadUrl.mockResolvedValueOnce({
      uploadUrl: "https://s3.example.com",
      fileKey: "key",
    });
    await controller.createUploadUrl({
      requestId: "req-1",
      developerId: "dev-1",
      dto: { fileName: "cv.pdf", contentType: "application/pdf" },
    });
    expect(mockService.createUploadUrl).toHaveBeenCalledWith("req-1", "dev-1", {
      fileName: "cv.pdf",
      contentType: "application/pdf",
    });
  });

  it("confirmUpload → délègue requestId, developerId et dto au service", async () => {
    mockService.confirmUpload.mockResolvedValueOnce({ status: "FULFILLED" });
    await controller.confirmUpload({
      requestId: "req-1",
      developerId: "dev-1",
      dto: { fileKey: "key", fileName: "cv.pdf" },
    });
    expect(mockService.confirmUpload).toHaveBeenCalledWith("req-1", "dev-1", {
      fileKey: "key",
      fileName: "cv.pdf",
    });
  });

  it("getDownloadUrl → délègue requestId, requesterId, requesterRole et disposition au service", async () => {
    mockService.getDownloadUrl.mockResolvedValueOnce({
      downloadUrl: "https://s3.example.com",
      fileName: "cv.pdf",
    });
    await controller.getDownloadUrl({
      requestId: "req-1",
      requesterId: "recruiter-1",
      requesterRole: "RECRUITER",
      disposition: "inline",
    });
    expect(mockService.getDownloadUrl).toHaveBeenCalledWith(
      "req-1",
      "recruiter-1",
      "RECRUITER",
      "inline",
    );
  });

  it("deleteDocument → délègue requestId et developerId au service", async () => {
    mockService.deleteDocument.mockResolvedValueOnce({
      removed: true,
      requestId: "req-1",
    });
    await controller.deleteDocument({
      requestId: "req-1",
      developerId: "dev-1",
    });
    expect(mockService.deleteDocument).toHaveBeenCalledWith("req-1", "dev-1");
  });

  it("getStats → délègue au service", async () => {
    mockService.getStats.mockResolvedValueOnce({ total: 0 });
    const result = await controller.getStats();
    expect(mockService.getStats).toHaveBeenCalled();
    expect(result).toEqual({ total: 0 });
  });
});
