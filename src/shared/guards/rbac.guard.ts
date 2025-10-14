import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import { ROLE } from '../../auth/constants/role.constant';

/**
 * RBACGuard - Generic Role-Based Access Control Guard
 *
 * This guard implements truly generic RBAC that works with ANY resource type
 * without requiring code modifications for new resources.
 *
 * Permission Structure:
 * - ADMIN: Full access to all resources
 * - USER: Access to customers and their related data
 * - CUSTOMER: Access only to their own data
 *
 * How it works:
 * 1. Determines resource type from URL
 * 2. Checks if resource exists and gets its owner
 * 3. Applies generic permission logic based on roles
 * 4. No hardcoded resource type checks needed!
 *
 * Usage:
 * @UseGuards(JwtAuthGuard, RBACGuard)
 */
@Injectable()
export class RBACGuard implements CanActivate {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const currentUser = request.user;

    if (!currentUser || !currentUser.id) {
      throw new UnauthorizedException('User not authenticated');
    }

    const currentUserRoles = currentUser.roles || [];
    const targetResourceId = parseInt(request.params.id, 10);

    if (!targetResourceId || isNaN(targetResourceId)) {
      throw new UnauthorizedException('Invalid target resource ID');
    }

    // Determine resource type from route
    const resourceType = this.getResourceTypeFromRoute(request.url);

    // Apply generic RBAC logic
    return this.checkGenericResourceAccess(
      currentUserRoles,
      resourceType,
      targetResourceId,
      currentUser.id,
    );
  }

  /**
   * Determine resource type from the request URL
   */
  private getResourceTypeFromRoute(url: string): string {
    const urlParts = url.split('/');
    return urlParts[1] || 'unknown';
  }

  /**
   * Generic RBAC logic that works for ANY resource type
   */
  private async checkGenericResourceAccess(
    currentUserRoles: string[],
    resourceType: string,
    targetResourceId: number,
    currentUserId: number,
  ): Promise<boolean> {
    // ADMIN: Full access to all resources
    if (currentUserRoles.includes(ROLE.ADMIN)) {
      return true;
    }

    // USER: Access to customers and their related data
    if (currentUserRoles.includes(ROLE.USER)) {
      return this.checkUserGenericAccess(resourceType, targetResourceId);
    }

    // CUSTOMER: Access only to their own data
    if (currentUserRoles.includes(ROLE.CUSTOMER)) {
      return this.checkCustomerGenericAccess(
        resourceType,
        targetResourceId,
        currentUserId,
      );
    }

    // Default: deny access
    return false;
  }

  /**
   * Generic access check for USER role
   * USER can access: customers and their related data
   */
  private async checkUserGenericAccess(
    resourceType: string,
    targetResourceId: number,
  ): Promise<boolean> {
    // For 'users' resource type, check if target is a customer
    if (resourceType === 'users') {
      return this.isTargetCustomer(targetResourceId);
    }

    // For all other resource types, check if the resource belongs to a customer
    return this.isResourceOwnedByCustomer(resourceType, targetResourceId);
  }

  /**
   * Generic access check for CUSTOMER role
   * CUSTOMER can access: only their own data
   */
  private async checkCustomerGenericAccess(
    resourceType: string,
    targetResourceId: number,
    currentUserId: number,
  ): Promise<boolean> {
    // For 'users' resource type, check if it's their own record
    if (resourceType === 'users') {
      return targetResourceId === currentUserId;
    }

    // For all other resource types, check if the resource belongs to them
    return this.isResourceOwnedByUser(
      resourceType,
      targetResourceId,
      currentUserId,
    );
  }

  /**
   * Check if target user is a customer
   */
  private async isTargetCustomer(userId: number): Promise<boolean> {
    try {
      const result = await this.dataSource.query(
        'SELECT roles FROM users WHERE id = $1',
        [userId],
      );

      if (!result || result.length === 0) {
        return false;
      }

      const roles = result[0].roles;
      return roles && roles.includes(ROLE.CUSTOMER);
    } catch {
      return false;
    }
  }

  /**
   * Generic method to check if ANY resource is owned by a customer
   * This method dynamically determines the relationship based on resource type
   */
  private async isResourceOwnedByCustomer(
    resourceType: string,
    resourceId: number,
  ): Promise<boolean> {
    try {
      // Get the resource owner ID using generic method
      const ownerId = await this.getResourceOwnerId(resourceType, resourceId);

      if (!ownerId) {
        return false;
      }

      // Check if the owner is a customer
      return this.isTargetCustomer(ownerId);
    } catch {
      return false;
    }
  }

  /**
   * Generic method to check if ANY resource is owned by a specific user
   */
  private async isResourceOwnedByUser(
    resourceType: string,
    resourceId: number,
    userId: number,
  ): Promise<boolean> {
    try {
      // Get the resource owner ID using generic method
      const ownerId = await this.getResourceOwnerId(resourceType, resourceId);

      // Check if the owner matches the current user
      return ownerId === userId;
    } catch {
      return false;
    }
  }

  /**
   * Generic method to get resource owner ID for ANY resource type
   * This method uses database relationships to determine ownership
   */
  private async getResourceOwnerId(
    resourceType: string,
    resourceId: number,
  ): Promise<number | null> {
    // This is a generic implementation that can be extended
    // For now, we'll implement common patterns

    switch (resourceType) {
      case 'users': {
        // For users, the owner is the user themselves

        return resourceId;
      }

      case 'orders': {
        // For orders, we need to check the customer relationship
        // This would query: SELECT customer_id FROM orders WHERE id = ?
        return await this.getOrderCustomerId(resourceId);
      }

      case 'emails': {
        // For emails, we need to check the recipient relationship
        // This would query: SELECT user_id FROM emails WHERE id = ?
        return await this.getEmailUserId(resourceId);
      }

      case 'articles': {
        // For articles, we need to check the author relationship
        // This would query: SELECT author_id FROM articles WHERE id = ?
        return await this.getArticleAuthorId(resourceId);
      }

      default: {
        // For unknown resource types, try to find a generic pattern
        // This could be extended to use reflection or configuration
        return await this.getGenericResourceOwnerId(resourceType, resourceId);
      }
    }
  }

  /**
   * Get customer ID for an order
   */
  private async getOrderCustomerId(orderId: number): Promise<number | null> {
    try {
      const result = await this.dataSource.query(
        'SELECT customer_id FROM orders WHERE id = $1',
        [orderId],
      );
      return result && result.length > 0 ? result[0].customer_id : null;
    } catch {
      return null;
    }
  }

  /**
   * Get user ID for an email
   */
  private async getEmailUserId(emailId: number): Promise<number | null> {
    try {
      const result = await this.dataSource.query(
        'SELECT user_id FROM emails WHERE id = $1',
        [emailId],
      );
      return result && result.length > 0 ? result[0].user_id : null;
    } catch {
      return null;
    }
  }

  /**
   * Get author ID for an article
   */
  private async getArticleAuthorId(articleId: number): Promise<number | null> {
    try {
      const result = await this.dataSource.query(
        'SELECT author_id FROM articles WHERE id = $1',
        [articleId],
      );
      return result && result.length > 0 ? result[0].author_id : null;
    } catch {
      return null;
    }
  }

  /**
   * Generic method to get resource owner for unknown resource types
   * This uses naming conventions to auto-detect owner fields
   */
  private async getGenericResourceOwnerId(
    resourceType: string,
    resourceId: number,
  ): Promise<number | null> {
    // Common owner field patterns
    const possibleOwnerFields = [
      'user_id',
      'customer_id',
      'author_id',
      'owner_id',
      'created_by',
      'user',
    ];

    // Try each field until one exists and returns a value
    for (const field of possibleOwnerFields) {
      try {
        const result = await this.dataSource.query(
          `SELECT ${field} FROM ${resourceType} WHERE id = $1`,
          [resourceId],
        );

        // eslint-disable-next-line security/detect-object-injection
        if (result && result.length > 0 && result[0][field]) {
          // eslint-disable-next-line security/detect-object-injection
          return result[0][field];
        }
      } catch {
        // Field doesn't exist, try next one
        continue;
      }
    }

    // No owner field found
    return null;
  }
}
