import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Role } from '@repo/types';

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

    if (role === Role.DEVELOPER) {
      await this.prisma.developerProfile.create({
        data: {
          userId,
          firstName: firstName ?? '',
          lastName: lastName ?? '',
        },
      });
    }

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
        const avatarUrl =
          user?.image?.startsWith('https://avatars.githubusercontent.com')
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

  async getProfile(userId: string) {
    const dev = await this.prisma.developerProfile.findUnique({
      where: { userId },
      include: {
        skills: { include: { skill: true } },
        technologies: true,
        projects: true,
      },
    });
    if (dev) return { role: Role.DEVELOPER, profile: dev };

    const rec = await this.prisma.recruiterProfile.findUnique({
      where: { userId },
      include: { company: true },
    });
    if (rec) return { role: Role.RECRUITER, profile: rec };

    throw new NotFoundException('Profil introuvable');
  }
}
