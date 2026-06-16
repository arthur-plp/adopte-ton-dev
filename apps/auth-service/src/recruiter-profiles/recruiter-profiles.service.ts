import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateRecruiterProfileDto } from '@repo/contracts';

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
    const profile = await this.prisma.recruiterProfile.findUnique({
      where: { userId },
      include: { company: true },
    });
    if (!profile) throw new NotFoundException('Profil recruteur introuvable');
    return profile;
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
