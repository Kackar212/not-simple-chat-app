import { PrismaClient } from '@prisma/client';
import { ChannelPermission } from '../src/common/permissions';
import { exclude } from '../src/common/utilities/object';

const GLOBAL_SERVER_NAME = 'ivU,4icAL!xuDF_3g 3j&Dz:8Np<9g>Ji';
const SYSTEM_ACCOUNT_NAME = 'Administration - Official Account';

const prisma = new PrismaClient();

async function seed() {
  const newUser = await prisma.user.upsert({
    where: {
      username: SYSTEM_ACCOUNT_NAME,
    },
    update: {},
    create: {
      username: SYSTEM_ACCOUNT_NAME,
      email: '',
      avatar: '',
      password: '',
      displayName: SYSTEM_ACCOUNT_NAME,
    },
    omit: {
      password: true,
      resetPasswordToken: true,
      email: true,
      updatedAt: true,
      createdAt: true,
      username: true,
      activateAccountToken: true,
      activationTokenExpiresIn: true,
      isAccountActive: true,
    },
  });

  const server = await prisma.server.upsert({
    where: {
      name_ownerName: {
        ownerName: SYSTEM_ACCOUNT_NAME,
        name: GLOBAL_SERVER_NAME,
      },
    },
    update: {},
    create: {
      name: GLOBAL_SERVER_NAME,
      ownerName: SYSTEM_ACCOUNT_NAME,
      ownerId: newUser.id,
      isGlobalServer: true,
      serverIcon: '',
      iconPlaceholder: '',
      roles: {
        create: {
          name: 'everyone',
          permissions: {
            createMany: {
              data: [
                { isAllowed: true, permission: ChannelPermission.Read },
                { isAllowed: true, permission: ChannelPermission.Write },
              ],
            },
          },
        },
      },
    },
  });

  await prisma.member.upsert({
    where: {
      serverId_userId: {
        serverId: server.id,
        userId: newUser.id,
      },
    },
    update: {},
    create: {
      serverId: server.id,
      userId: newUser.id,
      isOwner: true,
      roles: {
        create: {
          roleName: 'everyone',
          roleServerId: server.id,
        },
      },
      profile: {
        create: {
          ...exclude(newUser, ['id']),
          serverId: server.id,
        },
      },
    },
  });
}

async function main() {
  try {
    await seed();
    await prisma.$disconnect();
  } catch (e) {
    console.error(e);

    await prisma.$disconnect();

    process.exit(1);
  }
}

main();
