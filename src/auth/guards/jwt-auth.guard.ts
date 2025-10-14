import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Observable } from 'rxjs';

import { STRATEGY_JWT_AUTH } from '../constants/strategy.constant';

@Injectable()
export class JwtAuthGuard extends AuthGuard(STRATEGY_JWT_AUTH) {
  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    // Add your custom authentication logic here
    // for example, call super.logIn(request) to establish a session.
    return super.canActivate(context);
  }

  // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types, @typescript-eslint/explicit-function-return-type, @typescript-eslint/no-explicit-any
  handleRequest(error: any, user: any, info: any) {
    // You can throw an exception based on either "info" or "err" arguments
    if (error || !user) {
      throw error || new UnauthorizedException(`${info}`);
    }
    return user;
  }
}
