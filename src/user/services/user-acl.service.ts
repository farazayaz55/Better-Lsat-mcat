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
    // Admin can do all actions
    this.canDo(ROLE.ADMIN, [Action.MANAGE]);
    // Admin can delete any user
    this.canDo(ROLE.ADMIN, [Action.DELETE]);
    // Admin can update any user (users and customers)
    this.canDo(ROLE.ADMIN, [Action.UPDATE]);

    // Users can read any user
    this.canDo(ROLE.USER, [Action.READ]);
    // Users can only update customers (not other users)
    this.canDo(ROLE.USER, [Action.UPDATE], this.isTargetCustomer);
    // Users can only update themselves
    this.canDo(ROLE.USER, [Action.UPDATE], this.isUserItself);

    // Customers can read any user
    this.canDo(ROLE.CUSTOMER, [Action.READ]);
    // Customers can only update themselves
    this.canDo(ROLE.CUSTOMER, [Action.UPDATE], this.isUserItself);
  }

  isUserItself(resource: User, actor: IActor): boolean {
    return resource.id === actor.id;
  }

  isTargetCustomer(resource: User, _actor: IActor): boolean {
    // Check if the target user has CUSTOMER role
    return resource.roles && resource.roles.includes(ROLE.CUSTOMER);
  }
}
