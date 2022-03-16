import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';

@Injectable()
export class LocalAuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.getArgByIndex(0);
    console.log('req', req);
    console.log(
      '---------------------------------------------------------------------',
    );
    console.log('getClass', context.getClass());
    console.log(
      '-------------------------------------------------------------',
    );
    req.canIGetIt = true;
    return true;
  }
}
