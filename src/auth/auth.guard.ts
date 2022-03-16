import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';

@Injectable()
export class LocalAuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.getArgByIndex(0);
    const thisOne = context.getType();
    console.log('headers', req.header());
    console.log('req', req);
    console.log(
      '---------------------------------------------------------------------',
    );
    console.log(
      '-------------------------------------------------------------',
    );
    console.log('thisOne', thisOne);
    req.canIGetIt = true;
    return true;
  }
}
