/\*\*

- RBAC (Role-Based Access Control) Structure
-
- This document outlines the permission structure implemented by RBACGuard
  \*/

// ========================================
// ROLE DEFINITIONS
// ========================================

enum ROLE {
ADMIN = 'ADMIN', // Full system access
USER = 'USER', // Access to customers and their data
CUSTOMER = 'CUST', // Access only to own data
}

// ========================================
// PERMISSION MATRIX
// ========================================

/\*\*

- ADMIN Role Permissions:
- ✅ Full access to ALL resources
- - Users (all users, customers, admins)
- - Orders (all orders)
- - Emails (all emails)
- - Any other resource type
    _/
    const ADMIN_PERMISSIONS = {
    users: 'ALL', // Can access any user
    orders: 'ALL', // Can access any order
    emails: 'ALL', // Can access any email
    customers: 'ALL', // Can access any customer
    '_': 'ALL', // Can access any resource
    };

/\*\*

- USER Role Permissions:
- ✅ Access to customers and their related data
- ❌ Cannot access other users (non-customers)
  \*/
  const USER_PERMISSIONS = {
  users: 'CUSTOMERS_ONLY', // Can only access users with CUSTOMER role
  orders: 'CUSTOMER_ORDERS', // Can access orders belonging to customers
  emails: 'CUSTOMER_EMAILS', // Can access emails belonging to customers
  customers: 'ALL', // Can access all customer data
  // Other resources: DENIED
  };

/\*\*

- CUSTOMER Role Permissions:
- ✅ Access only to their own data
- ❌ Cannot access anyone else's data
  \*/
  const CUSTOMER_PERMISSIONS = {
  users: 'OWN_ONLY', // Can only access their own user record
  orders: 'OWN_ONLY', // Can only access their own orders
  emails: 'OWN_ONLY', // Can only access their own emails
  // Other resources: DENIED
  };

// ========================================
// RESOURCE RELATIONSHIPS
// ========================================

/\*\*

- Resource Access Patterns:
-
- 1.  DIRECT ACCESS:
- - /users/:id - Direct user access
- - /customers/:id - Direct customer access
-
- 2.  RELATED ACCESS:
- - /orders/:id - Order access (check if order belongs to customer)
- - /emails/:id - Email access (check if email belongs to customer)
-
- 3.  HIERARCHICAL ACCESS:
- - USER can access CUSTOMER data
- - CUSTOMER can only access own data
- - ADMIN can access everything
    \*/

// ========================================
// IMPLEMENTATION EXAMPLES
// ========================================

/\*\*

- Example 1: User accessing customer data
-
- Request: GET /users/123
- Current User: USER role
- Target User: CUSTOMER role
- Result: ✅ ALLOWED (USER can access customers)
  \*/
  const example1 = {
  currentUser: { role: 'USER', id: 456 },
  targetResource: { type: 'users', id: 123 },
  targetUserRole: 'CUSTOMER',
  result: 'ALLOWED'
  };

/\*\*

- Example 2: User trying to access another user
-
- Request: GET /users/789
- Current User: USER role
- Target User: USER role
- Result: ❌ DENIED (USER cannot access other users)
  \*/
  const example2 = {
  currentUser: { role: 'USER', id: 456 },
  targetResource: { type: 'users', id: 789 },
  targetUserRole: 'USER',
  result: 'DENIED'
  };

/\*\*

- Example 3: Customer accessing own data
-
- Request: GET /users/123
- Current User: CUSTOMER role, id: 123
- Target Resource: users/123
- Result: ✅ ALLOWED (CUSTOMER can access own data)
  \*/
  const example3 = {
  currentUser: { role: 'CUSTOMER', id: 123 },
  targetResource: { type: 'users', id: 123 },
  result: 'ALLOWED'
  };

/\*\*

- Example 4: Customer trying to access someone else's data
-
- Request: GET /users/456
- Current User: CUSTOMER role, id: 123
- Target Resource: users/456
- Result: ❌ DENIED (CUSTOMER cannot access others' data)
  \*/
  const example4 = {
  currentUser: { role: 'CUSTOMER', id: 123 },
  targetResource: { type: 'users', id: 456 },
  result: 'DENIED'
  };

// ========================================
// USAGE IN CONTROLLERS
// ========================================

/\*\*

- User Management Controller
  \*/
  class UserController {
  // Admin and User can access (but with different permissions)
  @Get('users/:id')
  @UseGuards(JwtAuthGuard, RBACGuard)
  async getUser(@Param('id') userId: number) {
  // RBACGuard automatically checks:
  // - ADMIN: Can access any user
  // - USER: Can only access customers
  // - CUSTOMER: Can only access own data
  }

// Only Admin can delete users
@Delete('users/:id')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(ROLE.ADMIN)
async deleteUser(@Param('id') userId: number) {
// Simple role check - only admins can delete
}
}

/\*\*

- Order Management Controller
  \*/
  class OrderController {
  // RBAC applies to order access
  @Get('orders/:id')
  @UseGuards(JwtAuthGuard, RBACGuard)
  async getOrder(@Param('id') orderId: number) {
  // RBACGuard automatically checks:
  // - ADMIN: Can access any order
  // - USER: Can only access customer orders
  // - CUSTOMER: Can only access own orders
  }
  }

// ========================================
// EXTENDING RBAC
// ========================================

/\*\*

- To add new resource types:
-
- 1.  Add case in checkUserAccess()
- 2.  Add case in checkCustomerAccess()
- 3.  Implement relationship checking methods
-
- Example: Adding 'articles' resource
  \*/
  const addArticlesResource = `
  // In checkUserAccess()
  case 'articles':
  return this.isArticleOwnedByCustomer(articleId);

// In checkCustomerAccess()
case 'articles':
return this.isArticleOwnedByUser(articleId, currentUserId);

// Implement methods
private async isArticleOwnedByCustomer(articleId: number): Promise<boolean> {
// Check if article author is a customer
}

private async isArticleOwnedByUser(articleId: number, userId: number): Promise<boolean> {
// Check if article belongs to user
}
`;

// ========================================
// ERROR HANDLING
// ========================================

/\*\*

- RBACGuard Error Responses:
-
- 401 Unauthorized:
- - User not authenticated
- - Invalid target resource ID
-
- 403 Forbidden:
- - Insufficient permissions for resource
- - Resource not accessible by user role
-
- 404 Not Found:
- - Target resource doesn't exist
- - Resource relationship not found
    \*/
