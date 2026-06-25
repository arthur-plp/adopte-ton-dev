import {
  Injectable,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Role } from '@repo/types';
import { Events } from '@repo/contracts';

async function retry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err: unknown) {
      if ((err as { code?: string }).code === 'P1017' && i < attempts - 1) {
        await new Promise((r) => setTimeout(r, 200 * (i + 1)));
        continue;
      }
      throw err;
    }
  }
  throw new Error('unreachable');
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async setRole(
    userId: string,
    role: Role,
    firstName?: string,
    lastName?: string,
  ) {
    const alreadyHasProfile =
      (await this.prisma.developerProfile.count({ where: { userId } })) > 0 ||
      (await this.prisma.recruiterProfile.count({ where: { userId } })) > 0;

    if (alreadyHasProfile) {
      throw new ConflictException(
        'Onboarding déjà effectué pour cet utilisateur',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      if (role === Role.DEVELOPER) {
        await tx.developerProfile.create({
          data: {
            userId,
            firstName: firstName ?? '',
            lastName: lastName ?? '',
          },
        });
      }
      await tx.user.update({
        where: { id: userId },
        data: { role, onboarded: true },
      });
    });

    return { userId, role };
  }

  async getAvatarOptions(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { image: true },
    });

    const accounts = await this.prisma.account.findMany({
      where: { userId },
      select: { providerId: true, accountId: true },
    });

    const options: { provider: string; avatarUrl: string }[] = [];

    for (const account of accounts) {
      if (account.providerId === 'github') {
        // BetterAuth stocke l'avatar GitHub dans user.image à la connexion.
        // On le préfère car c'est l'URL exacte retournée par l'API GitHub.
        // Fallback : URL construite depuis l'accountId (numeric GitHub user id).
        const avatarUrl = user?.image?.startsWith(
          'https://avatars.githubusercontent.com',
        )
          ? user.image
          : `https://avatars.githubusercontent.com/u/${account.accountId}?v=4`;
        options.push({ provider: 'github', avatarUrl });
      } else if (account.providerId === 'google' && user?.image) {
        options.push({
          provider: 'google',
          avatarUrl: user.image,
        });
      }
    }

    return options;
  }

  // ── Admin ────────────────────────────────────────────────────────────────

  async listUsers(
    page: number,
    pageSize: number,
    search?: string,
    role?: string,
  ) {
    const where: Record<string, unknown> = {};
    if (role) where['role'] = role;
    if (search) {
      where['OR'] = [
        { email: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
      ];
    }
    const skip = (page - 1) * pageSize;
    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          onboarded: true,
          createdAt: true,
          developerProfile: { select: { firstName: true, lastName: true } },
          recruiterProfile: {
            select: {
              firstName: true,
              lastName: true,
              company: { select: { name: true, siret: true } },
            },
          },
        },
      }),
      this.prisma.user.count({ where }),
    ]);
    return { data, total, page, pageSize };
  }

  async adminUpdateUser(userId: string, dto: { name?: string; role?: string }) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Utilisateur introuvable');
    if (user.role === Role.ADMIN)
      throw new ForbiddenException('Impossible de modifier un compte admin');
    if (dto.role === Role.RECRUITER)
      throw new ConflictException(
        'Impossible de passer un utilisateur en recruteur via cette modification : utilisez "Créer un compte recruteur" (un profil entreprise + SIRET est requis).',
      );
    return this.prisma.user.update({
      where: { id: userId },
      data: dto,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        onboarded: true,
        createdAt: true,
      },
    });
  }

  async adminDeleteUser(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Utilisateur introuvable');
    if (user.role === Role.ADMIN)
      throw new ForbiddenException('Impossible de supprimer un compte admin');
    await this.deleteUserAndEmitEvent(userId, user.role);
    return { ok: true };
  }

  // RGPD (CLAUDE.md §25) : droit à l'effacement, déclenché par l'utilisateur
  // lui-même plutôt que par un admin. Même opération de suppression que
  // adminDeleteUser, mais sans passer par le back-office.
  async deleteOwnAccount(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Utilisateur introuvable');
    if (user.role === Role.ADMIN)
      throw new ForbiddenException(
        'Un compte admin ne peut pas être supprimé depuis cette action',
      );
    await this.deleteUserAndEmitEvent(userId, user.role);
    return { ok: true };
  }

  // Le cascade Prisma/Postgres (onDelete: Cascade) supprime au passage les
  // sessions/comptes OAuth BetterAuth (mêmes tables, cf. en-tête du schema)
  // et le profil dev/recruteur. L'event user.deleted permet aux autres
  // services (jobs-svc, applications-svc…) de nettoyer leurs propres données
  // référencées par userId (pas de FK cross-service, cf. CLAUDE.md §10/§28).
  private async deleteUserAndEmitEvent(userId: string, role: string) {
    await this.prisma.$transaction([
      this.prisma.user.delete({ where: { id: userId } }),
      this.prisma.outboxEvent.create({
        data: { type: Events.USER_DELETED, payload: { userId, role } },
      }),
    ]);
  }

  async getStats() {
    const [total, developers, recruiters, admins] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { role: Role.DEVELOPER } }),
      this.prisma.user.count({ where: { role: Role.RECRUITER } }),
      this.prisma.user.count({ where: { role: Role.ADMIN } }),
    ]);
    return { total, developers, recruiters, admins };
  }

  async promoteToRecruiter(payload: {
    userId: string;
    companyName: string;
    companySiret?: string;
    firstName: string;
    lastName: string;
  }) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.userId },
    });
    if (!user) throw new NotFoundException('Utilisateur introuvable');
    if (user.role === Role.RECRUITER)
      throw new ConflictException('Cet utilisateur est déjà recruteur');
    if (user.role === Role.ADMIN)
      throw new ForbiddenException('Impossible de modifier un compte admin');

    const existingRecruiter = await this.prisma.recruiterProfile.findUnique({
      where: { userId: payload.userId },
    });
    if (existingRecruiter)
      throw new ConflictException(
        'Un profil recruteur existe déjà pour cet utilisateur',
      );

    if (payload.companySiret) {
      const companyWithSiret = await this.prisma.company.findUnique({
        where: { siret: payload.companySiret },
      });
      if (companyWithSiret && companyWithSiret.name !== payload.companyName)
        throw new ConflictException(
          `Ce SIRET est déjà utilisé par une autre entreprise (${companyWithSiret.name}).`,
        );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: payload.userId },
        data: { role: Role.RECRUITER, onboarded: true },
      });
      const company = await tx.company.upsert({
        where: { name: payload.companyName },
        update: payload.companySiret ? { siret: payload.companySiret } : {},
        create: { name: payload.companyName, siret: payload.companySiret },
      });
      await tx.recruiterProfile.create({
        data: {
          userId: payload.userId,
          firstName: payload.firstName,
          lastName: payload.lastName,
          companyId: company.id,
        },
      });
    });

    return { ok: true, userId: payload.userId };
  }

  async getProfile(userId: string) {
    const user = await retry(() =>
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { role: true },
      }),
    );
    if (!user) throw new NotFoundException('Utilisateur introuvable');

    const profile = await this.fetchProfileForRole(userId, user.role);
    return { role: user.role, profile };
  }

  // Identité normalisée pour un participant de conversation (messaging-svc),
  // quel que soit son rôle — y compris ADMIN, qui n'a ni DeveloperProfile ni
  // RecruiterProfile : on retombe alors sur le nom BetterAuth (User.name).
  async getParticipantInfo(userId: string) {
    const user = await retry(() =>
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { name: true, role: true, email: true },
      }),
    );
    if (!user) throw new NotFoundException('Utilisateur introuvable');

    if (user.role === Role.RECRUITER) {
      const profile = await retry(() =>
        this.prisma.recruiterProfile.findUnique({
          where: { userId },
          include: { company: true },
        }),
      );
      if (profile) {
        return {
          firstName: profile.firstName,
          lastName: profile.lastName,
          avatarUrl: profile.avatarUrl ?? null,
          companyName: profile.company?.name ?? null,
          role: user.role,
          email: user.email,
        };
      }
    } else if (user.role === Role.DEVELOPER) {
      const profile = await retry(() =>
        this.prisma.developerProfile.findUnique({ where: { userId } }),
      );
      if (profile) {
        return {
          firstName: profile.firstName,
          lastName: profile.lastName,
          avatarUrl: profile.avatarUrl ?? null,
          companyName: null,
          role: user.role,
          email: user.email,
        };
      }
    }

    const [firstName, ...rest] = user.name.split(' ');
    return {
      firstName: firstName ?? user.name,
      lastName: rest.join(' '),
      avatarUrl: null,
      companyName: null,
      role: user.role,
      email: user.email,
    };
  }

  // Profil manquant (edge case : rôle changé sans créer le profil) → retourner null
  private async fetchProfileForRole(userId: string, role: string) {
    if (role === Role.ADMIN) return null;

    if (role === Role.RECRUITER) {
      return retry(() =>
        this.prisma.recruiterProfile.findUnique({
          where: { userId },
          include: { company: true },
        }),
      );
    }

    // DEVELOPER (ou rôle inconnu traité comme developer)
    return retry(() =>
      this.prisma.developerProfile.findUnique({
        where: { userId },
        include: {
          skills: { include: { skill: true } },
          technologies: true,
          projects: true,
        },
      }),
    );
  }

  // RGPD (CLAUDE.md §25) : export des données personnelles détenues par
  // auth-service (identité + profil complet). Les données détenues par
  // jobs-svc/applications-svc sont agrégées séparément par la Gateway, qui
  // appelle déjà ces services (job.findMine / application.findMine).
  async exportData(userId: string) {
    const user = await retry(() =>
      this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          createdAt: true,
        },
      }),
    );
    if (!user) throw new NotFoundException('Utilisateur introuvable');

    const profile = await this.fetchProfileForRole(userId, user.role);
    return { user, profile, exportedAt: new Date().toISOString() };
  }
}
