import { Prisma } from '@prisma/client';

export type ChannelEntity = Prisma.ChannelGetPayload<{
  include: {
    server: {
      include: {
        members: true;
      };
    };
    messages: true;
  };
}>;
