import { Prisma, User } from '@prisma/client';
import { Request } from 'express';
import { ServerEntity as Server } from 'src/common';

export interface RequestWithUser extends Request {
  channel: Prisma.ChannelGetPayload<{
    include: {
      server: true;
      messages: true;
    };
  }>;
  member: Prisma.MemberGetPayload<{
    include: {
      user: {
        omit: {
          isAccountActive: true;
          activateAccountToken: true;
          activationTokenExpiresIn: true;
          password: true;
          email: true;
          isInvisible: true;
          resetPasswordToken: true;
        };
      };
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
