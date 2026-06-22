import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { RecruiterProfilesService } from './recruiter-profiles.service';
import {
  CreateRecruiterProfileSchema,
  UpdateRecruiterProfileSchema,
} from '@repo/contracts';

@Controller()
export class RecruiterProfilesController {
  constructor(private readonly service: RecruiterProfilesService) {}

  @MessagePattern({ cmd: 'recruiter.create' })
  create(@Payload() payload: { userId: string; data: unknown }) {
    const dto = CreateRecruiterProfileSchema.parse(payload.data);
    return this.service.create(payload.userId, dto);
  }

  @MessagePattern({ cmd: 'recruiter.getProfile' })
  findOne(@Payload() payload: { userId: string }) {
    return this.service.findByUserId(payload.userId);
  }

  @MessagePattern({ cmd: 'recruiter.updateProfile' })
  update(
    @Payload() payload: { userId: string; requesterId: string; data: unknown },
  ) {
    const dto = UpdateRecruiterProfileSchema.parse(payload.data);
    return this.service.update(payload.userId, payload.requesterId, dto);
  }
}
