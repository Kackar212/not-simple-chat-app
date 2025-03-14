import { Prisma } from '@prisma/client';
import { Request } from 'express';
import { ServerEntity as Server, User } from 'src/common';

export interface RequestWithUser extends Request {
  channel: Prisma.ChannelGetPayload<{
    include: {
      server: true;
      messages: true;
    };
  }>;
  member: Prisma.MemberGetPayload<{
    include: {
      user: true;
    };
  }>;
  user: User;
  server: Server;
  message: Prisma.MessageGetPayload<{
    select: {
      channelId: true;
      member: {
        select: {
          userId: true;
        };
      };
      channel: {
        include: {
          server: {
            include: {
              inviteLink: true;
            };
          };
        };
      };
    };
  }>;
}
