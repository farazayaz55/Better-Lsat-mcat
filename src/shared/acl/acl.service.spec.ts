import { Test, TestingModule } from '@nestjs/testing';

import { ROLE } from './../../auth/constants/role.constant';
import { BaseAclService } from './acl.service';
import { RuleCallback } from './acl-rule.constant';
import { Action } from './action.constant';

class MockResource {
  id: number;
}

class MockAclService extends BaseAclService<MockResource> {
  public canDo(
    role: ROLE,
    actions: Action[],
    ruleCallback?: RuleCallback<MockResource>,
  ) {
    super.canDo(role, actions, ruleCallback);
  }

  public getAclRules() {
    return this.aclRules;
  }
}

describe('AclService', () => {
  let service: MockAclService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MockAclService],
    }).compile();

    service = module.get<MockAclService>(MockAclService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('canDo', () => {
    it('should add acl rule', () => {
      service.canDo(ROLE.USER, [Action.READ]);
      const aclRules = service.getAclRules();
      expect(aclRules).toContainEqual({
        role: ROLE.USER,
        actions: [Action.READ],
      });
    });

    it('should add acl rule with custom rule', () => {
      const ruleCallback = jest.fn();

      service.canDo(ROLE.USER, [Action.READ], ruleCallback);

      const aclRules = service.getAclRules();

      expect(aclRules).toContainEqual({
        role: ROLE.USER,
        actions: [Action.READ],
        ruleCallback,
      });
    });
  });

  describe('forActor', () => {
    const user = {
      id: 6,
      username: 'foo',
      roles: [ROLE.USER],
    };

    const admin = {
      id: 7,
      username: 'admin',
      roles: [ROLE.ADMIN],
    };

    it('should return canDoAction method', () => {
      const userAcl = service.forActor(user);
      expect(userAcl.canDoAction).toBeDefined();
    });

    it('should return false when no role sepcific rules found', () => {
      service.canDo(ROLE.USER, [Action.READ]);
      const userAcl = service.forActor(admin);
      expect(userAcl.canDoAction(Action.READ)).toBeFalsy();
    });

    it('should return false when no action sepcific rules found', () => {
      service.canDo(ROLE.USER, [Action.READ]);
      const userAcl = service.forActor(user);
      expect(userAcl.canDoAction(Action.READ)).toBeFalsy();
    });

    it('should return true when role has action permission', () => {
      service.canDo(ROLE.USER, [Action.READ]);
      const userAcl = service.forActor(user);
      expect(userAcl.canDoAction(Action.READ)).toBeTruthy();
    });

    it('should return true when ruleCallback is true', () => {
      const customOwnerRule = jest.fn();
      customOwnerRule.mockReturnValue(true);
      service.canDo(ROLE.USER, [Action.READ], customOwnerRule);
      const userAcl = service.forActor(user);
      expect(userAcl.canDoAction(Action.READ, new MockResource())).toBeTruthy();
    });

    it('should return false when ruleCallback is false', () => {
      const customOwnerRule = jest.fn();
      customOwnerRule.mockReturnValue(false);
      service.canDo(ROLE.USER, [Action.MANAGE], customOwnerRule);
      const userAcl = service.forActor(user);
      expect(userAcl.canDoAction(Action.READ, new MockResource())).toBeFalsy();
    });
  });
});
