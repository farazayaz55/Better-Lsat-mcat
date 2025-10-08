import { Injectable } from '@nestjs/common';

import { BaseAclService } from '../../shared/acl/acl.service';
import { User } from '../entities/user.entity';
import { ROLE } from './../../auth/constants/role.constant';
import { Action } from './../../shared/acl/action.constant';
import { IActor } from './../../shared/acl/actor.constant';

@Injectable()
export class UserAclService extends BaseAclService<User> {
  constructor() {
    super();
    // Admin can do all action
    this.canDo(ROLE.ADMIN, [Action.MANAGE]);
    //user can read himself or any other user
    this.canDo(ROLE.USER, [Action.READ]);
    // user can only update himself
    this.canDo(ROLE.USER, [Action.UPDATE], this.isUserItself);
  }

  isUserItself(resource: User, actor: IActor): boolean {
    return resource.id === actor.id;
  }
}
