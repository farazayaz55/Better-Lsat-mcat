import { Injectable } from '@nestjs/common';

import { BaseAclService } from '../../shared/acl/acl.service';
import { Task } from '../entities/task.entity';
import { ROLE } from './../../auth/constants/role.constant';
import { Action } from './../../shared/acl/action.constant';
import { IActor } from './../../shared/acl/actor.constant';

@Injectable()
export class TaskAclService extends BaseAclService<Task> {
  constructor() {
    super();

    // Admin can do all actions on any task
    this.canDo(ROLE.ADMIN, [Action.MANAGE]);
    this.canDo(ROLE.ADMIN, [Action.CREATE]);
    this.canDo(ROLE.ADMIN, [Action.READ]);
    this.canDo(ROLE.ADMIN, [Action.UPDATE]);
    this.canDo(ROLE.ADMIN, [Action.DELETE]);
    this.canDo(ROLE.ADMIN, [Action.LIST]);

    // Users can only perform operations on tasks that belong to them
    this.canDo(ROLE.USER, [Action.CREATE]); // No resource callback needed for CREATE
    this.canDo(ROLE.USER, [Action.READ], this.isTaskOwner);
    this.canDo(ROLE.USER, [Action.UPDATE], this.isTaskOwner);
    this.canDo(ROLE.USER, [Action.DELETE], this.isTaskOwner);
    // Users can list tasks, but service enforces ownership filter
    this.canDo(ROLE.USER, [Action.LIST]);

    // Customers have no access to tasks
    // this.canDo(ROLE.CUSTOMER, [Action.READ]); // Removed - customers shouldn't see tasks
  }

  /**
   * Check if the actor is the owner of the task
   * @param resource The task to check
   * @param actor The user performing the action
   * @returns true if the actor owns the task
   */
  isTaskOwner(resource: Task, actor: IActor): boolean {
    return resource.tutorId === actor.id;
  }
}
