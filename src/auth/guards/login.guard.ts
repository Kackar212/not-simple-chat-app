import { ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { validate } from 'class-validator';
import { getHttpException } from 'src/common';
import { SignInDTO } from '../dto/sign-in.dto';

export class LoginGuard extends AuthGuard('local') {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    //console.log(request.body);
    const errors = await validate(new SignInDTO(request.body));

    if (errors.length > 0) {
      throw getHttpException(
        errors.flatMap(({ constraints }) => {
          return Object.values(constraints || {});
        }),
      );
    }

    await super.canActivate(context);
    await super.logIn(request);

    return true;
  }
}
