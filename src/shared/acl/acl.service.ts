/* eslint-disable sonarjs/cognitive-complexity */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { ROLE } from './../../auth/constants/role.constant';
import { AclRule, RuleCallback } from './acl-rule.constant';
import { Action } from './action.constant';
import { IActor } from './actor.constant';

export class BaseAclService<Resource> {
  /**
   * ACL rules
   */
  protected aclRules: AclRule<Resource>[] = [];

  /**
   * Set ACL rule for a role
   */
  protected canDo(
    role: ROLE,
    actions: Action[],
    ruleCallback?: RuleCallback<Resource>,
  ): void {
    if (ruleCallback) {
      this.aclRules.push({ role, actions, ruleCallback });
    } else {
      this.aclRules.push({ role, actions });
    }
  }

  /**
   * create user specific acl object to check ability to perform any action
   */
  public forActor = (
    actor: IActor,
  ): { canDoAction: (action: Action, resource?: Resource) => boolean } => ({
    canDoAction: (action: Action, resource?: Resource) => {
      let canDoAction = false;

      const actorRoles = actor.roles ?? [];
      for (const actorRole of actorRoles) {
        //If already has access, return
        if (canDoAction) {
          true;
          continue;
        }

        //find all rules for given user role
        const aclRules = this.aclRules.filter(
          (rule) => rule.role === actorRole,
        );

        //for each rule, check action permission
        for (const aclRule of aclRules) {
          //If already has access, return
          if (canDoAction) {
            true;
            continue;
          }

          //check action permission
          const hasActionPermission =
            aclRule.actions.includes(action) ||
            aclRule.actions.includes(Action.MANAGE);

          // If action is not permitted, skip callback entirely
          if (!hasActionPermission) {
            canDoAction = false;
            continue;
          }

          //check for custom `ruleCallback` callback
          if (aclRule.ruleCallback) {
            if (!resource) {
              throw new Error('Resource is required for ruleCallback');
            }

            canDoAction = aclRule.ruleCallback(resource, actor);
          } else {
            canDoAction = true;
          }
        }
      }

      return canDoAction;
    },
  });
}
