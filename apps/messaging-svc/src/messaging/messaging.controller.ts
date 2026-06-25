import { Controller } from "@nestjs/common";
import { MessagePattern, Payload } from "@nestjs/microservices";
import { MessagingService } from "./messaging.service";

@Controller()
export class MessagingController {
  constructor(private readonly service: MessagingService) {}

  @MessagePattern({ cmd: "messaging.createConversation" })
  createConversation(
    @Payload()
    data: {
      developerId: string;
      recruiterId: string;
      jobOfferId?: string;
    },
  ) {
    return this.service.createOrGetConversation(
      data.developerId,
      data.recruiterId,
      data.jobOfferId,
    );
  }

  @MessagePattern({ cmd: "messaging.listConversations" })
  listConversations(@Payload() data: { userId: string }) {
    return this.service.listConversations(data.userId);
  }

  @MessagePattern({ cmd: "messaging.getMessages" })
  getMessages(
    @Payload()
    data: {
      conversationId: string;
      requesterId: string;
      page: number;
    },
  ) {
    return this.service.getMessages(
      data.conversationId,
      data.requesterId,
      data.page,
    );
  }

  @MessagePattern({ cmd: "messaging.sendMessage" })
  sendMessage(
    @Payload()
    data: {
      conversationId: string;
      senderId: string;
      content: string;
    },
  ) {
    return this.service.sendMessage(
      data.conversationId,
      data.senderId,
      data.content,
    );
  }

  @MessagePattern({ cmd: "messaging.markRead" })
  markRead(@Payload() data: { conversationId: string; requesterId: string }) {
    return this.service.markRead(data.conversationId, data.requesterId);
  }
}
