import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { RealtimeGateway } from './realtime.gateway';

@Controller()
export class RealtimeController {
  constructor(private readonly realtimeGateway: RealtimeGateway) {}

  @MessagePattern({ cmd: 'realtime.pushToUser' })
  pushToUser(
    @Payload() data: { userId: string; event: string; payload: unknown },
  ) {
    this.realtimeGateway.pushToUser(data.userId, data.event, data.payload);
    return { delivered: true };
  }
}
