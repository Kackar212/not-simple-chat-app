import { PassportSerializer } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/common/prisma/prisma.service';

@Injectable()
export class AuthSerializer extends PassportSerializer {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  serializeUser(user: { id: number }, done: CallableFunction) {
    done(null, user.id);
  }

  async deserializeUser(userId: string, done: CallableFunction) {
    const user = await this.prisma.user.findUnique({
      where: { id: Number(userId) },
    });

    done(null, user);
  }
}
