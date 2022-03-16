import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';

@Injectable()
export class LocalAuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.getArgByIndex(0);
    const what = context.getArgs();
    const thisOne = context.getType();
    console.log('req', req);
    console.log(
      '---------------------------------------------------------------------',
    );
    console.log('what', what);
    console.log(
      '-------------------------------------------------------------',
    );
    console.log('thisOne', thisOne);
    return true;
  }
}
