import { Test, TestingModule } from "@nestjs/testing";
import { MessagingController } from "./messaging.controller";
import { MessagingService } from "./messaging.service";

const mockService = {
  createOrGetConversation: jest.fn(),
  listConversations: jest.fn(),
  getMessages: jest.fn(),
  sendMessage: jest.fn(),
  markRead: jest.fn(),
  deleteConversation: jest.fn(),
};

describe("MessagingController", () => {
  let controller: MessagingController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MessagingController],
      providers: [{ provide: MessagingService, useValue: mockService }],
    }).compile();
    controller = module.get<MessagingController>(MessagingController);
    jest.clearAllMocks();
  });

  it("createConversation → délègue au service", () => {
    controller.createConversation({
      developerId: "dev-1",
      recruiterId: "recruiter-1",
      jobOfferId: "job-1",
    });
    expect(mockService.createOrGetConversation).toHaveBeenCalledWith(
      "dev-1",
      "recruiter-1",
      "job-1",
    );
  });

  it("listConversations → délègue au service", () => {
    controller.listConversations({ userId: "dev-1" });
    expect(mockService.listConversations).toHaveBeenCalledWith("dev-1");
  });

  it("getMessages → délègue au service", () => {
    controller.getMessages({
      conversationId: "conv-1",
      requesterId: "dev-1",
      page: 1,
    });
    expect(mockService.getMessages).toHaveBeenCalledWith("conv-1", "dev-1", 1);
  });

  it("sendMessage → délègue au service", () => {
    controller.sendMessage({
      conversationId: "conv-1",
      senderId: "dev-1",
      content: "Salut",
    });
    expect(mockService.sendMessage).toHaveBeenCalledWith(
      "conv-1",
      "dev-1",
      "Salut",
    );
  });

  it("markRead → délègue au service", () => {
    controller.markRead({ conversationId: "conv-1", requesterId: "dev-1" });
    expect(mockService.markRead).toHaveBeenCalledWith("conv-1", "dev-1");
  });

  it("deleteConversation → délègue au service", () => {
    controller.deleteConversation({
      conversationId: "conv-1",
      requesterId: "dev-1",
    });
    expect(mockService.deleteConversation).toHaveBeenCalledWith(
      "conv-1",
      "dev-1",
    );
  });
});
