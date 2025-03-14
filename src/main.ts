import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { createClient } from 'redis';
import { ValidationPipe } from '@nestjs/common';
import { WsAdapter } from './common/adapters/socket-io.adapter';
import RedisStore from 'connect-redis';
import passport from 'passport';
import session from 'express-session';
import cookieParser from 'cookie-parser';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { readFile } from 'fs/promises';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: true,
    cors: {
      methods: ['POST', 'PATCH', 'PUT', 'GET', 'DELETE', 'OPTIONS', 'HEAD'],
      origin: process.env.CLIENT_URL,
      credentials: true,
    },
    httpsOptions:
      process.env.NODE_ENV === 'development'
        ? {
            cert: await readFile('./localhost.pem'),
            key: await readFile('./localhost-key.pem'),
            rejectUnauthorized: false,
          }
        : undefined,
  });

  app.set('trust proxy', 1);

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  app.useStaticAssets(join(__dirname, '..', 'public'), {
    index: false,
    prefix: '/public/',
  });
  app.use(cookieParser());

  const configService = app.get(ConfigService);

  const redisClient = await createClient({
    url: process.env.REDIS_URL,
    socket: {
      reconnectStrategy(retries) {
        if (retries > 20) {
          console.log(
            'Too many attempts to reconnect. Redis connection was terminated',
          );
          return new Error('Too many retries.');
        } else {
          return retries * 500;
        }
      },
    },
  }).connect();

  redisClient.on('error', (error) => {
    console.error(`Redis client error:`, error);
  });

  const redisStore = new RedisStore({
    client: redisClient,
  });

  const sessionMiddleware = session({
    store: redisStore,
    secret: configService.get<string>('SESSION_SECRET')!,
    resave: false,
    saveUninitialized: false,
    cookie: {
      sameSite: process.env.NODE_ENV !== 'development' ? 'none' : 'lax',
      secure: process.env.NODE_ENV !== 'development',
      httpOnly: true,
      path: '/',
      domain: process.env.DOMAIN,
    },
  });

  app.use(sessionMiddleware);
  app.use(passport.session());
  app.useWebSocketAdapter(new WsAdapter(app, sessionMiddleware));

  await app.listen(process.env.PORT || 4000);
}

bootstrap();
