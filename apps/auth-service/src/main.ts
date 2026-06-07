import { NestFactory } from "@nestjs/core";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix("api/v1");

  const config = new DocumentBuilder()
    .setTitle("Adopte Ton Dev — Auth / Users Service")
    .setDescription("Service interne : profils développeurs, recruteurs, entreprises.")
    .setVersion("1.0")
    .addTag("users", "Onboarding & profil utilisateur")
    .addTag("developer-profiles", "Profils développeurs + portfolio + GitHub sync")
    .addTag("recruiter-profiles", "Profils recruteurs & entreprises")
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup("api/docs", app, document, {
    swaggerOptions: { persistAuthorization: true },
  });

  const port = process.env["PORT"] ?? 3001;
  await app.listen(port);
}
bootstrap();