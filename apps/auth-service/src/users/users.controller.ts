import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { UsersService } from './users.service';
import { Role } from '@repo/types';

@Controller()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @MessagePattern({ cmd: 'users.onboarding' })
  onboarding(
    @Payload()
    payload: {
      userId: string;
      role: Role;
      firstName?: string;
      lastName?: string;
    },
  ) {
    return this.usersService.setRole(
      payload.userId,
      payload.role,
      payload.firstName,
      payload.lastName,
    );
  }

  @MessagePattern({ cmd: 'users.getProfile' })
  getProfile(@Payload() payload: { userId: string }) {
    return this.usersService.getProfile(payload.userId);
  }

  @MessagePattern({ cmd: 'users.getParticipantInfo' })
  getParticipantInfo(@Payload() payload: { userId: string }) {
    return this.usersService.getParticipantInfo(payload.userId);
  }

  @MessagePattern({ cmd: 'users.getAvatarOptions' })
  getAvatarOptions(@Payload() payload: { userId: string }) {
    return this.usersService.getAvatarOptions(payload.userId);
  }

  @MessagePattern({ cmd: 'users.exportData' })
  exportData(@Payload() payload: { userId: string }) {
    return this.usersService.exportData(payload.userId);
  }

  @MessagePattern({ cmd: 'users.deleteOwnAccount' })
  deleteOwnAccount(@Payload() payload: { userId: string }) {
    return this.usersService.deleteOwnAccount(payload.userId);
  }

  // ── Admin ────────────────────────────────────────────────────────────────

  @MessagePattern({ cmd: 'admin.listUsers' })
  listUsers(
    @Payload()
    payload: {
      page: number;
      pageSize: number;
      search?: string;
      role?: string;
    },
  ) {
    return this.usersService.listUsers(
      payload.page,
      payload.pageSize,
      payload.search,
      payload.role,
    );
  }

  @MessagePattern({ cmd: 'admin.getStats' })
  getStats() {
    return this.usersService.getStats();
  }

  @MessagePattern({ cmd: 'admin.listCompanies' })
  listCompanies(
    @Payload() payload: { page: number; pageSize: number; search?: string },
  ) {
    return this.usersService.listCompanies(
      payload.page,
      payload.pageSize,
      payload.search,
    );
  }

  @MessagePattern({ cmd: 'admin.promoteToRecruiter' })
  promoteToRecruiter(
    @Payload()
    payload: {
      userId: string;
      companyName: string;
      firstName: string;
      lastName: string;
    },
  ) {
    return this.usersService.promoteToRecruiter(payload);
  }

  @MessagePattern({ cmd: 'admin.updateUser' })
  updateUser(
    @Payload() payload: { userId: string; name?: string; role?: string },
  ) {
    return this.usersService.adminUpdateUser(payload.userId, {
      name: payload.name,
      role: payload.role,
    });
  }

  @MessagePattern({ cmd: 'admin.deleteUser' })
  deleteUser(@Payload() payload: { userId: string }) {
    return this.usersService.adminDeleteUser(payload.userId);
  }
}
