import {
  BadRequestException,
  Controller,
  Get,
  HttpException,
  Inject,
  Logger,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import {
  ApiTags,
  ApiOperation,
  ApiCookieAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { lastValueFrom } from 'rxjs';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@repo/types';
import { MatchingSearchFiltersSchema } from '@repo/contracts';

const logger = new Logger('MatchingController');

function toHttpException(err: unknown): never {
  logger.error(
    `Appel MATCHING_SVC échoué : ${err instanceof Error ? err.stack : JSON.stringify(err)}`,
  );
  if (typeof err === 'object' && err !== null) {
    const e = err as Record<string, unknown>;
    if (typeof e['statusCode'] === 'number') {
      throw new HttpException(
        String(e['message'] ?? 'Erreur'),
        e['statusCode'],
      );
    }
    if (typeof e['message'] === 'string') {
      throw new HttpException(e['message'], 500);
    }
  }
  throw new HttpException('Erreur interne', 500);
}

@ApiTags('matching')
@ApiCookieAuth('better-auth.session_token')
@Controller('matching')
@UseGuards(AuthGuard, RolesGuard)
export class MatchingController {
  constructor(
    @Inject('MATCHING_SVC')
    private readonly matchingClient: ClientProxy,
  ) {}

  @Get('developers')
  @Roles(Role.RECRUITER, Role.ADMIN)
  @ApiOperation({
    summary: 'Rechercher des profils développeurs (avec score de matching)',
  })
  @ApiQuery({ name: 'technologies', required: false, isArray: true })
  @ApiQuery({
    name: 'levels',
    required: false,
    description: 'JSON {"React":"ADVANCED"}',
  })
  @ApiQuery({ name: 'remoteOk', required: false })
  @ApiQuery({ name: 'location', required: false })
  @ApiQuery({ name: 'jobOfferId', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'pageSize', required: false })
  async searchDevelopers(
    @Query() rawQuery: unknown,
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '20',
  ) {
    const result = MatchingSearchFiltersSchema.safeParse(rawQuery);
    if (!result.success) throw new BadRequestException(result.error.flatten());

    try {
      return await lastValueFrom(
        this.matchingClient.send(
          { cmd: 'matching.searchDevelopers' },
          {
            ...result.data,
            page: Math.max(1, parseInt(page, 10)),
            pageSize: Math.min(100, parseInt(pageSize, 10)),
          },
        ),
      );
    } catch (err: unknown) {
      toHttpException(err);
    }
  }
}
