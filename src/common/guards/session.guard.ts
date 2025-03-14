import {
  ExecutionContext,
  Injectable,
  CanActivate,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ErrorCode } from '../constants';

@Injectable()
export class SessionGuard implements CanActivate {
  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();

    const isAuthenticated = request.isAuthenticated();

    if (!isAuthenticated) {
      response
        .status(401)
        .cookie('connect.sid', '', {
          sameSite: process.env.NODE_ENV !== 'development' ? 'strict' : 'none',
          secure: true,
          httpOnly: true,
          path: '/',
          domain: process.env.DOMAIN,
          maxAge: -1,
        })
        .json({
          code: ErrorCode.Unauthorized,
          message: 'Unauthorized',
          statusCode: HttpStatus.UNAUTHORIZED,
        });
    }

    return isAuthenticated;
  }
}
