import {
  Injectable,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Role } from '@repo/types';

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
    await this.prisma.user.delete({ where: { id: userId } });
    return { ok: true };
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

    if (user.role === Role.ADMIN) return { role: Role.ADMIN, profile: null };

    if (user.role === Role.RECRUITER) {
      const rec = await retry(() =>
        this.prisma.recruiterProfile.findUnique({
          where: { userId },
          include: { company: true },
        }),
      );
      // Profil manquant (edge case : rôle changé sans créer le profil) → retourner null
      return { role: Role.RECRUITER, profile: rec ?? null };
    }

    // DEVELOPER (ou rôle inconnu traité comme developer)
    const dev = await retry(() =>
      this.prisma.developerProfile.findUnique({
        where: { userId },
        include: {
          skills: { include: { skill: true } },
          technologies: true,
          projects: true,
        },
      }),
    );
    return { role: Role.DEVELOPER, profile: dev ?? null };
  }
}
