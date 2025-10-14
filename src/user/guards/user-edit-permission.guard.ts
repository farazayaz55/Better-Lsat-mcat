import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

import { ROLE } from '../../auth/constants/role.constant';
import { UserService } from '../services/user.service';

/**
 * ComplexPermissionGuard - A reusable guard for complex permission logic
 *
 * This guard can be applied to any endpoint that needs to check permissions
 * based on both the current user's role and the target resource's properties.
 *
 * Usage:
 * @UseGuards(JwtAuthGuard, ComplexPermissionGuard)
 *
 * The guard will automatically:
 * 1. Extract the current user from the request
 * 2. Extract the target resource ID from route parameters
 * 3. Apply the permission logic based on roles
 *
 * Permission Matrix:
 * - ADMIN: Can perform operations on anyone
 * - USER: Can perform operations on customers only
 * - CUSTOMER: Cannot perform operations on anyone
 */
@Injectable()
export class ComplexPermissionGuard implements CanActivate {
  constructor(private readonly userService: UserService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const currentUser = request.user;

    if (!currentUser || !currentUser.id) {
      throw new UnauthorizedException('User not authenticated');
    }

    // Extract target resource ID from route parameters
    // This works for any endpoint with :id parameter
    const targetUserId = parseInt(request.params.id, 10);

    if (!targetUserId || isNaN(targetUserId)) {
      throw new UnauthorizedException('Invalid target resource ID');
    }

    // Get the target user to check their role
    const targetUser = await this.userService.getUserById(
      { user: currentUser } as any,
      targetUserId,
    );

    if (!targetUser) {
      throw new UnauthorizedException('Target user not found');
    }

    const currentUserRoles = currentUser.roles || [];
    const targetUserRoles = targetUser.roles || [];

    // Apply permission logic
    return this.checkPermission(currentUserRoles, targetUserRoles);
  }

  /**
   * Core permission logic - can be overridden or extended
   * @param currentUserRoles - Roles of the current user
   * @param targetUserRoles - Roles of the target user
   * @returns boolean - whether the operation is allowed
   */
  private checkPermission(
    currentUserRoles: string[],
    targetUserRoles: string[],
  ): boolean {
    // Admin can perform operations on anyone (users and customers)
    if (currentUserRoles.includes(ROLE.ADMIN)) {
      return true;
    }

    // Users can only perform operations on customers (users with CUST role)
    if (currentUserRoles.includes(ROLE.USER)) {
      return targetUserRoles.includes(ROLE.CUSTOMER);
    }

    // Customers cannot perform operations on anyone
    if (currentUserRoles.includes(ROLE.CUSTOMER)) {
      return false;
    }

    // Default: deny access
    return false;
  }
}
