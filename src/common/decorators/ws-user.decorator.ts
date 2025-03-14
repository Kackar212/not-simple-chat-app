import { ExecutionContext, createParamDecorator } from '@nestjs/common';

export const WsUser = createParamDecorator(
  (data: unknown, context: ExecutionContext) => {
    const client = context.switchToWs().getClient();

    return client.conn.request.user;
  },
);
