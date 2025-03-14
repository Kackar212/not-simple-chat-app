import { CanActivate, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

export class LogoutGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    if (!request.isAuthenticated()) {
      return false;
    }

    request.logOut({ keepSessionInfo: false }, (err) => console.log(err));

    return true;
  }
}
