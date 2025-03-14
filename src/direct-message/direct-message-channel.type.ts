import { Prisma, User } from '@prisma/client';

export type DirectMessageChannel = Prisma.ChannelGetPayload<{
  select: {
    isRequestAccepted: true;
    channelUsers: {
      select: {
        memberId: true;
        member: {
          select: {
            user: {
              select: {
                displayName: true;
                avatar: true;
                username: true;
                status: true;
                id: true;
                backgroundColor: true;
                backgroundImage: true;
                createdAt: true;
              };
            };
          };
        };
      };
    };
    id: true;
    name: true;
  };
}> & {
  isBlocked: boolean;
  recipient: User & {
    isFriend: boolean;
    isInvited: boolean;
    hasFriendRequest: boolean;
    isBlocked: boolean;
    isCurrentUserBlocked: boolean;
    memberId: number;
  };
  isRequestAccepted: boolean | null;
  channelUsers: void;
  isDeleted: boolean;
};
