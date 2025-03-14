import { Module } from '@nestjs/common';
import { MessageService } from './message.service';
import { PrismaModule } from 'src/common/prisma/prisma.module';
import { ConfigService } from '@nestjs/config';
import { EmbedService } from 'src/embed/embed.service';
import { DirectMessageService } from 'src/direct-message/direct-message.service';

@Module({
  imports: [PrismaModule],
  providers: [
    ConfigService,
    EmbedService,
    ConfigService,
    MessageService,
    DirectMessageService,
  ],
})
export class MessageModule {}
