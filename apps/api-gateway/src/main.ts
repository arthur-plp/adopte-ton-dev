import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api/v1');
  app.enableCors({
    origin: process.env['CORS_ORIGIN'] ?? 'http://localhost:3000',
    credentials: true,
  });

  const config = new DocumentBuilder()
    .setTitle('Adopte Ton Dev — API Gateway')
    .setDescription('Point d\'entrée HTTP public. Authentification via cookie de session BetterAuth.')
    .setVersion('1.0')
    .addCookieAuth('better-auth.session_token')
    .addTag('users', 'Profils développeurs & recruteurs, onboarding')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
  });

  const port = process.env['PORT'] ?? 4000;
  await app.listen(port);
}
bootstrap();