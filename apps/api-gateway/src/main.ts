import { NestFactory } from '@nestjs/core';
import { Transport } from '@nestjs/microservices';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  // rawBody: true expose req.rawBody (Buffer) sur toutes les requêtes, nécessaire
  // pour vérifier la signature des webhooks Stripe (payment-svc) sur l'octet exact
  // reçu — un body re-sérialisé en JSON casserait la vérification HMAC.
  const app = await NestFactory.create(AppModule, { rawBody: true });

  // contentSecurityPolicy désactivée : cette gateway sert une API JSON + Swagger
  // UI (scripts/styles inline), pas du contenu utilisateur rendu — la CSP qui
  // protège vraiment les utilisateurs est celle du front Next.js. Le reste des
  // protections Helmet (X-Content-Type-Options, X-Frame-Options…) reste actif.
  app.use(helmet({ contentSecurityPolicy: false }));

  app.setGlobalPrefix('api/v1');
  app.enableCors({
    origin: process.env['CORS_ORIGIN'] ?? 'http://localhost:3000',
    credentials: true,
  });

  const config = new DocumentBuilder()
    .setTitle('Adopte Ton Dev — API Gateway')
    .setDescription(
      "Point d'entrée HTTP public. Authentification via cookie de session BetterAuth.",
    )
    .setVersion('1.0')
    .addCookieAuth('better-auth.session_token')
    .addTag('users', 'Profils développeurs & recruteurs, onboarding')
    .addTag('job-offers', 'Offres de stage, alternance et premier emploi')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
  });

  // App hybride : écoute TCP en plus du HTTP, pour que notifications-svc
  // puisse appeler `realtime.pushToUser` (cf. RealtimeModule) sans exposer
  // de nouveau port public — le WebSocket (Socket.IO) partage lui le serveur
  // HTTP existant, donc pas de port supplémentaire non plus côté navigateur.
  app.connectMicroservice({
    transport: Transport.TCP,
    options: {
      host: process.env['GATEWAY_TCP_HOST'] ?? '0.0.0.0',
      port: parseInt(process.env['GATEWAY_TCP_PORT'] ?? '4001', 10),
    },
  });
  await app.startAllMicroservices();

  const port = process.env['PORT'] ?? 4000;
  await app.listen(port);
}
bootstrap();
