import { Module } from '@nestjs/common';
import { DeveloperProfilesController } from './developer-profiles.controller';
import { DeveloperProfilesService } from './developer-profiles.service';
import { GitHubSyncService } from './github-sync.service';

@Module({
  controllers: [DeveloperProfilesController],
  providers: [DeveloperProfilesService, GitHubSyncService],
  exports: [DeveloperProfilesService],
})
export class DeveloperProfilesModule {}
