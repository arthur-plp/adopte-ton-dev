import { Body, Controller, Get, Param, Post, HttpCode } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiParam,
  ApiBody,
  ApiResponse,
} from '@nestjs/swagger';
import { UsersService } from './users.service';
import { Role } from '@repo/types';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post('onboarding')
  @HttpCode(200)
  @ApiOperation({ summary: 'Crée le profil initial (appelé par la Gateway)' })
  @ApiBody({
    schema: {
      example: {
        userId: 'cuid',
        role: 'DEVELOPER',
        firstName: 'Alice',
        lastName: 'Dev',
      },
    },
  })
  @ApiResponse({ status: 200, description: '{ userId, role }' })
  @ApiResponse({ status: 409, description: 'Onboarding déjà effectué' })
  async onboarding(
    @Body()
    body: {
      userId: string;
      role: Role;
      firstName?: string;
      lastName?: string;
    },
  ) {
    return this.usersService.setRole(
      body.userId,
      body.role,
      body.firstName,
      body.lastName,
    );
  }

  @Get(':userId/profile')
  @ApiOperation({ summary: "Récupère le profil complet d'un utilisateur" })
  @ApiParam({ name: 'userId', description: 'ID utilisateur BetterAuth' })
  @ApiResponse({ status: 200, description: '{ role, profile }' })
  @ApiResponse({ status: 404, description: 'Profil introuvable' })
  async getProfile(@Param('userId') userId: string) {
    return this.usersService.getProfile(userId);
  }

  @Get(':userId/avatar-options')
  @ApiOperation({ summary: "Options d'avatar selon les providers OAuth liés" })
  @ApiParam({ name: 'userId', description: 'ID utilisateur BetterAuth' })
  @ApiResponse({ status: 200, description: '[{ provider, avatarUrl }]' })
  async getAvatarOptions(@Param('userId') userId: string) {
    return this.usersService.getAvatarOptions(userId);
  }
}
