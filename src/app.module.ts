import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { ChannelModule } from './channel/channel.module';
import { ServerModule } from './server/server.module';
import { MailerModule } from '@nestjs-modules/mailer';
import { HandlebarsAdapter } from '@nestjs-modules/mailer/dist/adapters/handlebars.adapter';
import { MulterModule } from '@nestjs/platform-express';
import { DirectMessageModule } from 'src/direct-message/direct-message.module';
import { UserModule } from 'src/user/user.module';
import { FriendModule } from './friend/friend.module';
import { StaticFilesModule } from './static-files/static-files.module';
import * as Joi from '@hapi/joi';
import { ExternalController } from './external/external.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath:
        process.env.NODE_ENV !== 'development' ? '.env.production' : '.env',
      isGlobal: true,
      validationSchema: Joi.object({
        DATABASE_URL: Joi.string().required(),
        SESSION_SECRET: Joi.string().required(),
        APP_URL: Joi.string().uri().required(),
        CLIENT_URL: Joi.string().uri().required(),
        GLOBAL_SERVER_NAME: Joi.string().required(),
        SYSTEM_ACCOUNT_NAME: Joi.string().required(),
        TENOR_API_BASE_URL: Joi.string().required(),
        TENOR_API_KEY: Joi.string().required(),
        SCRAPE_API_KEY: Joi.string().required(),
      }),
    }),
    MulterModule.register({
      limits: {
        files: 10,
      },
    }),
    MailerModule.forRootAsync({
      useFactory() {
        return {
          transport: {
            host: 'smtp.gmail.com',
            port: 465,
            secure: true,
            auth: {
              user: 'kackar212@gmail.com',
              pass: process.env.GMAIL_APP_SPECIFIC_PASSWORD,
            },
          },
          template: {
            dir: `${process.cwd()}/src/common/templates/`,
            adapter: new HandlebarsAdapter(),
          },
        };
      },
    }),
    StaticFilesModule,
    FriendModule,
    UserModule,
    AuthModule,
    ServerModule,
    ChannelModule,
    DirectMessageModule,
  ],
  controllers: [ExternalController],
})
export class AppModule {}
