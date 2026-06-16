import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiParam,
  ApiBody,
  ApiResponse,
} from '@nestjs/swagger';
import { RecruiterProfilesService } from './recruiter-profiles.service';
import {
  CreateRecruiterProfileSchema,
  type CreateRecruiterProfileDto,
} from '@repo/contracts';

type CreateBody = { userId: string; data: CreateRecruiterProfileDto };

@ApiTags('recruiter-profiles')
@Controller('recruiter-profiles')
export class RecruiterProfilesController {
  constructor(private readonly service: RecruiterProfilesService) {}

  @Post()
  @ApiOperation({ summary: 'Créer un profil recruteur (lié à une entreprise)' })
  @ApiBody({
    schema: {
      example: {
        userId: 'cuid',
        data: { firstName: 'Bob', lastName: 'Rec', companyId: 'cuid' },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'RecruiterProfile créé' })
  create(@Body() body: CreateBody) {
    const dto = CreateRecruiterProfileSchema.parse(body.data);
    return this.service.create(body.userId, dto);
  }

  @Get(':userId')
  @ApiOperation({ summary: 'Profil recruteur avec entreprise' })
  @ApiParam({ name: 'userId', description: 'ID utilisateur' })
  @ApiResponse({ status: 200, description: 'RecruiterProfile avec Company' })
  @ApiResponse({ status: 404, description: 'Profil introuvable' })
  findOne(@Param('userId') userId: string) {
    return this.service.findByUserId(userId);
  }
}
