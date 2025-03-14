import { INestApplicationContext } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { RequestHandler } from 'express';
import passport from 'passport';
import { Server, ServerOptions } from 'socket.io';

export class WsAdapter extends IoAdapter {
  private session: RequestHandler;

  constructor(app: INestApplicationContext, session: RequestHandler) {
    super(app);

    this.session = session;
  }

  createIOServer(port: number, options?: ServerOptions): any {
    const server = super.createIOServer(port, options) as Server;

    server.engine.use(this.session);
    server.engine.use(passport.session());

    return server;
  }
}
