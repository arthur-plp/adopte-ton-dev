import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type {
  CreateRecruiterProfileDto,
  UpdateRecruiterProfileDto,
} from '@repo/contracts';

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
export class RecruiterProfilesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateRecruiterProfileDto) {
    return this.prisma.recruiterProfile.create({
      data: { userId, ...dto },
      include: { company: true },
    });
  }

  async findByUserId(userId: string) {
    const profile = await retry(() =>
      this.prisma.recruiterProfile.findUnique({
        where: { userId },
        include: { company: true },
      }),
    );
    if (!profile) throw new NotFoundException('Profil recruteur introuvable');
    return profile;
  }

  async update(
    userId: string,
    requesterId: string,
    dto: UpdateRecruiterProfileDto,
  ) {
    if (userId !== requesterId) throw new ForbiddenException();

    const existing = await this.prisma.recruiterProfile.findUnique({
      where: { userId },
    });

    const {
      companyName,
      companySiret,
      companyWebsite,
      companyDescription,
      companyLocation,
      companySector,
      companySize,
      ...profileData
    } = dto;
    const companyData: Record<string, string | undefined> = {};
    if (companySiret !== undefined)
      companyData['siret'] = companySiret || undefined;
    if (companyWebsite !== undefined)
      companyData['website'] = companyWebsite || undefined;
    if (companyDescription !== undefined)
      companyData['description'] = companyDescription;
    if (companyLocation !== undefined)
      companyData['location'] = companyLocation;
    if (companySector !== undefined) companyData['sector'] = companySector;
    if (companySize !== undefined) companyData['size'] = companySize;

    // Cas où le profil recruteur n'existe pas encore (rôle promu sans création du profil)
    if (!existing) {
      return this.prisma.$transaction(async (tx) => {
        const company = await tx.company.upsert({
          where: { name: companyName ?? 'Mon entreprise' },
          update: Object.keys(companyData).length > 0 ? companyData : {},
          create: { name: companyName ?? 'Mon entreprise', ...companyData },
        });
        return tx.recruiterProfile.create({
          data: {
            userId,
            companyId: company.id,
            firstName: profileData.firstName ?? '',
            lastName: profileData.lastName ?? '',
            ...profileData,
          },
          include: { company: true },
        });
      });
    }

    const [updatedProfile] = await this.prisma.$transaction([
      this.prisma.recruiterProfile.update({
        where: { userId },
        data: profileData,
        include: { company: true },
      }),
      ...(Object.keys(companyData).length > 0
        ? [
            this.prisma.company.update({
              where: { id: existing.companyId },
              data: companyData,
            }),
          ]
        : []),
    ]);

    return updatedProfile;
  }

  async ensureOwnership(userId: string, requesterId: string) {
    const profile = await this.prisma.recruiterProfile.findUnique({
      where: { userId },
    });
    if (!profile) throw new NotFoundException();
    if (profile.userId !== requesterId) throw new ForbiddenException();
    return profile;
  }
}
