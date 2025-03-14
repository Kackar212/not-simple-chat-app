import { ExecutionContext, createParamDecorator } from '@nestjs/common';

export const Server = createParamDecorator(
  (_data: undefined, context: ExecutionContext) => {
    const request = context.switchToHttp().getRequest();

    return request.server;
  },
);
