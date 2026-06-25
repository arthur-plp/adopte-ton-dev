import { Test, TestingModule } from "@nestjs/testing";
import { NotificationsController } from "./notifications.controller";
import { NotificationsService } from "./notifications.service";

const mockService = {
  list: jest.fn(),
  markRead: jest.fn(),
  markAllRead: jest.fn(),
  upsertJobAlert: jest.fn(),
  getJobAlert: jest.fn(),
  deleteJobAlert: jest.fn(),
};

describe("NotificationsController", () => {
  let controller: NotificationsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [NotificationsController],
      providers: [{ provide: NotificationsService, useValue: mockService }],
    }).compile();
    controller = module.get<NotificationsController>(NotificationsController);
    jest.clearAllMocks();
  });

  it("list → délègue au service", () => {
    controller.list({ userId: "user-1", page: 1 });
    expect(mockService.list).toHaveBeenCalledWith("user-1", 1);
  });

  it("markRead → délègue au service", () => {
    controller.markRead({ id: "notif-1", requesterId: "user-1" });
    expect(mockService.markRead).toHaveBeenCalledWith("notif-1", "user-1");
  });

  it("markAllRead → délègue au service", () => {
    controller.markAllRead({ userId: "user-1" });
    expect(mockService.markAllRead).toHaveBeenCalledWith("user-1");
  });

  it("upsertJobAlert → délègue au service", () => {
    controller.upsertJobAlert({
      developerId: "dev-1",
      dto: { technologies: ["React"] },
    });
    expect(mockService.upsertJobAlert).toHaveBeenCalledWith("dev-1", {
      technologies: ["React"],
    });
  });

  it("getJobAlert → délègue au service", () => {
    controller.getJobAlert({ developerId: "dev-1" });
    expect(mockService.getJobAlert).toHaveBeenCalledWith("dev-1");
  });

  it("deleteJobAlert → délègue au service", () => {
    controller.deleteJobAlert({ developerId: "dev-1" });
    expect(mockService.deleteJobAlert).toHaveBeenCalledWith("dev-1");
  });
});
