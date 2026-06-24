import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import {
  DeveloperProfilesService,
  type SkillLevel,
} from './developer-profiles.service';
import { GitHubSyncService } from './github-sync.service';
import {
  CreateDeveloperProfileSchema,
  UpdateDeveloperProfileSchema,
} from '@repo/contracts';

@Controller()
export class DeveloperProfilesController {
  constructor(
    private readonly service: DeveloperProfilesService,
    private readonly githubSync: GitHubSyncService,
  ) {}

  // ── Profil ───────────────────────────────────────────────────────────────

  @MessagePattern({ cmd: 'developer.create' })
  create(
    @Payload() payload: { userId: string; requesterId: string; data: unknown },
  ) {
    const dto = CreateDeveloperProfileSchema.parse(payload.data);
    return this.service.create(payload.userId, dto);
  }

  @MessagePattern({ cmd: 'developer.getProfile' })
  findOne(@Payload() payload: { userId: string }) {
    return this.service.findByUserId(payload.userId);
  }

  @MessagePattern({ cmd: 'developer.search' })
  search(
    @Payload()
    payload: {
      technologies?: string[];
      remoteOk?: boolean;
      location?: string;
      latitude?: number;
      longitude?: number;
      radiusKm?: number;
      page: number;
      pageSize: number;
    },
  ) {
    return this.service.search(payload);
  }

  @MessagePattern({ cmd: 'developer.updateProfile' })
  update(
    @Payload() payload: { userId: string; requesterId: string; data: unknown },
  ) {
    const dto = UpdateDeveloperProfileSchema.parse(payload.data);
    return this.service.update(payload.userId, payload.requesterId, dto);
  }

  // ── Technologies ─────────────────────────────────────────────────────────

  @MessagePattern({ cmd: 'developer.getTechnologies' })
  getTechnologies(@Payload() payload: { userId: string }) {
    return this.service.getTechnologies(payload.userId);
  }

  @MessagePattern({ cmd: 'developer.addTechnology' })
  addTechnology(
    @Payload()
    payload: {
      userId: string;
      requesterId: string;
      name: string;
      level: SkillLevel;
    },
  ) {
    return this.service.addTechnology(payload.userId, payload.requesterId, {
      name: payload.name,
      level: payload.level,
    });
  }

  @MessagePattern({ cmd: 'developer.updateTechnology' })
  updateTechnology(
    @Payload()
    payload: {
      userId: string;
      requesterId: string;
      techId: string;
      level: SkillLevel;
    },
  ) {
    return this.service.updateTechnology(
      payload.userId,
      payload.requesterId,
      payload.techId,
      payload.level,
    );
  }

  @MessagePattern({ cmd: 'developer.deleteTechnology' })
  deleteTechnology(
    @Payload() payload: { userId: string; requesterId: string; techId: string },
  ) {
    return this.service.deleteTechnology(
      payload.userId,
      payload.requesterId,
      payload.techId,
    );
  }

  // ── Skills ────────────────────────────────────────────────────────────────

  @MessagePattern({ cmd: 'developer.getSkillsCatalog' })
  listSkills() {
    return this.service.listAvailableSkills();
  }

  @MessagePattern({ cmd: 'developer.getSkills' })
  getSkills(@Payload() payload: { userId: string }) {
    return this.service.getSkills(payload.userId);
  }

  @MessagePattern({ cmd: 'developer.addSkill' })
  addSkill(
    @Payload()
    payload: {
      userId: string;
      requesterId: string;
      skillId?: string;
      name?: string;
      category?: string;
      level: SkillLevel;
    },
  ) {
    return this.service.addSkill(payload.userId, payload.requesterId, {
      skillId: payload.skillId,
      name: payload.name,
      category: payload.category,
      level: payload.level,
    });
  }

  @MessagePattern({ cmd: 'developer.updateSkill' })
  updateSkill(
    @Payload()
    payload: {
      userId: string;
      requesterId: string;
      skillId: string;
      level: SkillLevel;
    },
  ) {
    return this.service.updateSkill(
      payload.userId,
      payload.requesterId,
      payload.skillId,
      payload.level,
    );
  }

  @MessagePattern({ cmd: 'developer.removeSkill' })
  removeSkill(
    @Payload()
    payload: {
      userId: string;
      requesterId: string;
      skillId: string;
    },
  ) {
    return this.service.removeSkill(
      payload.userId,
      payload.requesterId,
      payload.skillId,
    );
  }

  // ── Projets ───────────────────────────────────────────────────────────────

  @MessagePattern({ cmd: 'developer.githubSync' })
  syncGitHub(@Payload() payload: { userId: string }) {
    return this.githubSync.syncForUser(payload.userId);
  }

  @MessagePattern({ cmd: 'developer.getProjects' })
  getProjects(@Payload() payload: { userId: string }) {
    return this.service.getProjects(payload.userId);
  }

  @MessagePattern({ cmd: 'developer.createProject' })
  createProject(
    @Payload()
    payload: {
      userId: string;
      requesterId: string;
      title: string;
      description: string;
      repoUrl?: string;
      liveUrl?: string;
      technologies: string[];
    },
  ) {
    return this.service.createProject(payload.userId, payload.requesterId, {
      title: payload.title,
      description: payload.description,
      repoUrl: payload.repoUrl,
      liveUrl: payload.liveUrl,
      technologies: payload.technologies ?? [],
    });
  }

  @MessagePattern({ cmd: 'developer.reorderProjects' })
  reorderProjects(
    @Payload()
    payload: {
      userId: string;
      requesterId: string;
      order: { id: string; displayOrder: number }[];
    },
  ) {
    return this.service.reorderProjects(
      payload.userId,
      payload.requesterId,
      payload.order,
    );
  }

  @MessagePattern({ cmd: 'developer.updateProject' })
  updateProject(
    @Payload()
    payload: {
      userId: string;
      requesterId: string;
      projectId: string;
      title?: string;
      description?: string;
      repoUrl?: string;
      liveUrl?: string;
      technologies?: string[];
      visible?: boolean;
    },
  ) {
    const { userId, requesterId, projectId, ...dto } = payload;
    return this.service.updateProject(userId, requesterId, projectId, dto);
  }

  @MessagePattern({ cmd: 'developer.deleteProject' })
  deleteProject(
    @Payload()
    payload: {
      userId: string;
      requesterId: string;
      projectId: string;
    },
  ) {
    return this.service.deleteProject(
      payload.userId,
      payload.requesterId,
      payload.projectId,
    );
  }
}
