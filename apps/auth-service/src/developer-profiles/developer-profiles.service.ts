import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type {
  CreateDeveloperProfileDto,
  UpdateDeveloperProfileDto,
} from '@repo/contracts';
import { Events } from '@repo/contracts/events';
import { haversineDistanceKm } from './geo.util';

const DEFAULT_SEARCH_RADIUS_KM = 25;

export type SkillLevel = 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';

type TechnologyDto = { name: string; level: SkillLevel };
type ProjectCreateDto = {
  title: string;
  description: string;
  repoUrl?: string;
  liveUrl?: string;
  technologies: string[];
};
type ProjectUpdateDto = Partial<ProjectCreateDto & { visible: boolean }>;

@Injectable()
export class DeveloperProfilesService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Helpers ──────────────────────────────────────────────────────────────

  private async requireProfile(userId: string) {
    const profile = await this.prisma.developerProfile.findUnique({
      where: { userId },
    });
    if (!profile) throw new NotFoundException('Profil développeur introuvable');
    return profile;
  }

  private async requireOwner(userId: string, requesterId: string) {
    const profile = await this.requireProfile(userId);
    if (profile.userId !== requesterId) throw new ForbiddenException();
    return profile;
  }

  private emitProfileUpdated(userId: string, changes: object) {
    return this.prisma.outboxEvent.create({
      data: {
        type: Events.DEVELOPER_PROFILE_UPDATED,
        payload: { userId, changes },
      },
    });
  }

  // ── Profil ───────────────────────────────────────────────────────────────

  async create(userId: string, dto: CreateDeveloperProfileDto) {
    return this.prisma.developerProfile.create({ data: { userId, ...dto } });
  }

  async findByUserId(userId: string) {
    const profile = await this.prisma.developerProfile.findUnique({
      where: { userId },
      include: {
        skills: { include: { skill: true } },
        technologies: { orderBy: { name: 'asc' } },
        projects: {
          orderBy: [{ displayOrder: 'asc' }, { githubPushedAt: 'desc' }],
        },
      },
    });
    if (!profile) throw new NotFoundException('Profil développeur introuvable');
    return profile;
  }

  async update(
    userId: string,
    requesterId: string,
    dto: UpdateDeveloperProfileDto,
  ) {
    const profile = await this.requireOwner(userId, requesterId);

    const [updated] = await this.prisma.$transaction([
      this.prisma.developerProfile.update({ where: { userId }, data: dto }),
      this.emitProfileUpdated(userId, dto),
    ]);

    return updated;
    void profile;
  }

  // ── Technologies ─────────────────────────────────────────────────────────

  async getTechnologies(userId: string) {
    const profile = await this.requireProfile(userId);
    return this.prisma.developerTechnology.findMany({
      where: { profileId: profile.id },
      orderBy: { name: 'asc' },
    });
  }

  async addTechnology(userId: string, requesterId: string, dto: TechnologyDto) {
    const profile = await this.requireOwner(userId, requesterId);

    const exists = await this.prisma.developerTechnology.findFirst({
      where: {
        profileId: profile.id,
        name: { equals: dto.name, mode: 'insensitive' },
      },
    });
    if (exists)
      throw new ConflictException(`Technologie "${dto.name}" déjà ajoutée`);

    const [tech] = await this.prisma.$transaction([
      this.prisma.developerTechnology.create({
        data: { profileId: profile.id, ...dto },
      }),
      this.emitProfileUpdated(userId, { addedTechnology: dto.name }),
    ]);
    return { id: tech.id, name: tech.name, level: tech.level };
  }

  async updateTechnology(
    userId: string,
    requesterId: string,
    techId: string,
    level: SkillLevel,
  ) {
    const profile = await this.requireOwner(userId, requesterId);

    const tech = await this.prisma.developerTechnology.findUnique({
      where: { id: techId },
    });
    if (!tech || tech.profileId !== profile.id)
      throw new NotFoundException('Technologie introuvable');

    const [updated] = await this.prisma.$transaction([
      this.prisma.developerTechnology.update({
        where: { id: techId },
        data: { level },
      }),
      this.emitProfileUpdated(userId, { updatedTechnology: tech.name, level }),
    ]);
    return updated;
  }

  async deleteTechnology(userId: string, requesterId: string, techId: string) {
    const profile = await this.requireOwner(userId, requesterId);

    const tech = await this.prisma.developerTechnology.findUnique({
      where: { id: techId },
    });
    if (!tech || tech.profileId !== profile.id)
      throw new NotFoundException('Technologie introuvable');

    await this.prisma.$transaction([
      this.prisma.developerTechnology.delete({ where: { id: techId } }),
      this.emitProfileUpdated(userId, { removedTechnology: tech.name }),
    ]);
    return { deleted: true };
  }

  // ── Skills (catalog) ─────────────────────────────────────────────────────

  async getSkills(userId: string) {
    const profile = await this.requireProfile(userId);
    return this.prisma.developerSkill.findMany({
      where: { profileId: profile.id },
      include: { skill: true },
      orderBy: { skill: { name: 'asc' } },
    });
  }

  async listAvailableSkills() {
    return this.prisma.skill.findMany({ orderBy: { name: 'asc' } });
  }

  async addSkill(
    userId: string,
    requesterId: string,
    payload: {
      skillId?: string;
      name?: string;
      category?: string;
      level: SkillLevel;
    },
  ) {
    const profile = await this.requireOwner(userId, requesterId);

    let skill: { id: string; name: string };

    if (payload.skillId) {
      const found = await this.prisma.skill.findUnique({
        where: { id: payload.skillId },
      });
      if (!found) throw new NotFoundException('Compétence introuvable');
      skill = found;
    } else if (payload.name) {
      skill = await this.prisma.skill.upsert({
        where: { name: payload.name },
        create: {
          name: payload.name,
          category: payload.category ?? 'technique',
        },
        update: {},
      });
    } else {
      throw new BadRequestException('skillId ou name requis');
    }

    const exists = await this.prisma.developerSkill.findFirst({
      where: { profileId: profile.id, skillId: skill.id },
    });
    if (exists) throw new ConflictException('Compétence déjà ajoutée');

    const [entry] = await this.prisma.$transaction([
      this.prisma.developerSkill.create({
        data: {
          profileId: profile.id,
          skillId: skill.id,
          level: payload.level,
        },
        include: { skill: true },
      }),
      this.emitProfileUpdated(userId, { addedSkill: skill.name }),
    ]);
    return entry;
  }

  async updateSkill(
    userId: string,
    requesterId: string,
    skillId: string,
    level: SkillLevel,
  ) {
    const profile = await this.requireOwner(userId, requesterId);

    const entry = await this.prisma.developerSkill.findFirst({
      where: { profileId: profile.id, skillId },
    });
    if (!entry)
      throw new NotFoundException('Compétence non trouvée dans le profil');

    const [updated] = await this.prisma.$transaction([
      this.prisma.developerSkill.update({
        where: { id: entry.id },
        data: { level },
        include: { skill: true },
      }),
      this.emitProfileUpdated(userId, { updatedSkill: skillId, level }),
    ]);
    return updated;
  }

  async removeSkill(userId: string, requesterId: string, skillId: string) {
    const profile = await this.requireOwner(userId, requesterId);

    const entry = await this.prisma.developerSkill.findFirst({
      where: { profileId: profile.id, skillId },
    });
    if (!entry)
      throw new NotFoundException('Compétence non trouvée dans le profil');

    await this.prisma.$transaction([
      this.prisma.developerSkill.delete({ where: { id: entry.id } }),
      this.emitProfileUpdated(userId, { removedSkill: skillId }),
    ]);
    return { deleted: true };
  }

  // ── Projets ───────────────────────────────────────────────────────────────

  async getProjects(userId: string) {
    const profile = await this.requireProfile(userId);
    return this.prisma.project.findMany({
      where: { profileId: profile.id },
      orderBy: [
        { displayOrder: 'asc' },
        { githubPushedAt: 'desc' },
        { githubStars: 'desc' },
      ],
    });
  }

  async createProject(
    userId: string,
    requesterId: string,
    dto: ProjectCreateDto,
  ) {
    const profile = await this.requireOwner(userId, requesterId);

    return this.prisma.project.create({
      data: { profileId: profile.id, ...dto },
    });
  }

  async updateProject(
    userId: string,
    requesterId: string,
    projectId: string,
    dto: ProjectUpdateDto,
  ) {
    const profile = await this.requireOwner(userId, requesterId);

    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });
    if (!project || project.profileId !== profile.id)
      throw new NotFoundException('Projet introuvable');

    return this.prisma.project.update({ where: { id: projectId }, data: dto });
  }

  async reorderProjects(
    userId: string,
    requesterId: string,
    order: { id: string; displayOrder: number }[],
  ) {
    const profile = await this.requireOwner(userId, requesterId);

    await this.prisma.$transaction(
      order.map(({ id, displayOrder }) =>
        this.prisma.project.updateMany({
          where: { id, profileId: profile.id },
          data: { displayOrder },
        }),
      ),
    );
    return { updated: order.length };
  }

  async deleteProject(userId: string, requesterId: string, projectId: string) {
    const profile = await this.requireOwner(userId, requesterId);

    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });
    if (!project || project.profileId !== profile.id)
      throw new NotFoundException('Projet introuvable');

    await this.prisma.project.delete({ where: { id: projectId } });
    return { deleted: true };
  }

  // ── Recherche (appelée par matching-svc) ────────────────────────────────

  async search(filters: {
    technologies?: string[];
    remoteOk?: boolean;
    location?: string;
    latitude?: number;
    longitude?: number;
    radiusKm?: number;
    page: number;
    pageSize: number;
  }) {
    const where: Record<string, unknown> = {};
    if (filters.technologies?.length)
      where['technologies'] = { some: { name: { in: filters.technologies } } };
    if (filters.remoteOk !== undefined) where['remoteOk'] = filters.remoteOk;

    const hasCoordinates =
      filters.latitude !== undefined && filters.longitude !== undefined;

    if (!hasCoordinates) {
      if (filters.location)
        where['location'] = { contains: filters.location, mode: 'insensitive' };

      const skip = (filters.page - 1) * filters.pageSize;
      const [data, total] = await Promise.all([
        this.prisma.developerProfile.findMany({
          where,
          include: { technologies: true },
          skip,
          take: filters.pageSize,
        }),
        this.prisma.developerProfile.count({ where }),
      ]);

      return { data, total, page: filters.page, pageSize: filters.pageSize };
    }

    // Recherche par proximité ("villes proches") : pas de PostGIS dans la
    // stack, donc impossible de filtrer/trier par distance en SQL. On
    // récupère tous les candidats correspondant aux autres filtres, puis on
    // filtre/trie/pagine en mémoire à partir de la distance Haversine.
    return this.searchByProximity(where, filters);
  }

  private async searchByProximity(
    where: Record<string, unknown>,
    filters: {
      location?: string;
      latitude?: number;
      longitude?: number;
      radiusKm?: number;
      page: number;
      pageSize: number;
    },
  ) {
    const radiusKm = filters.radiusKm ?? DEFAULT_SEARCH_RADIUS_KM;
    const origin = {
      latitude: filters.latitude as number,
      longitude: filters.longitude as number,
    };
    const locationText = filters.location?.toLowerCase();

    const candidates = await this.prisma.developerProfile.findMany({
      where,
      include: { technologies: true },
    });

    const withDistance = candidates
      .map((profile) => ({
        profile,
        distanceKm:
          profile.latitude !== null && profile.longitude !== null
            ? haversineDistanceKm(origin, {
                latitude: profile.latitude,
                longitude: profile.longitude,
              })
            : null,
      }))
      .filter(({ profile, distanceKm }) => {
        if (distanceKm !== null) return distanceKm <= radiusKm;
        // Repli pour les profils sans coordonnées enregistrées : correspondance textuelle.
        return (
          !!locationText &&
          !!profile.location?.toLowerCase().includes(locationText)
        );
      })
      .sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));

    const total = withDistance.length;
    const skip = (filters.page - 1) * filters.pageSize;
    const data = withDistance
      .slice(skip, skip + filters.pageSize)
      .map(({ profile }) => profile);

    return { data, total, page: filters.page, pageSize: filters.pageSize };
  }
}
