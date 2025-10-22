import { Injectable } from '@nestjs/common';
import { ROLE } from '../auth/constants/role.constant';
import { Action } from '../shared/acl/action.constant';
import { BaseAclService } from '../shared/acl/acl.service';

@Injectable()
export class DashboardAclService extends BaseAclService<any> {
  constructor() {
    super();
    this.setupAclRules();
  }

  private setupAclRules(): void {
    // Allow all roles to read dashboard data
    this.canDo(ROLE.ADMIN, [Action.READ]);
    this.canDo(ROLE.USER, [Action.READ]);
    this.canDo(ROLE.CUSTOMER, [Action.READ]);
  }
}
