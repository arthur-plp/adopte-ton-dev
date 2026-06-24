import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { MatchingModule } from "./matching/matching.module";

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), MatchingModule],
})
export class AppModule {}
