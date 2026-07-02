export const ADMIN_ROLES = ['admin', 'super_admin', 'support'];

export const ROLE_PERMISSIONS = {
  super_admin: ['*'],
  admin: [
    'packages',
    'orders',
    'promos',
    'checkers',
    'sliders',
    'analytics',
    'api_providers',
    'promo_checkout',
  ],
  support: ['orders', 'analytics', 'checkers_read'],
};

export const hasPermission = (role, permission) => {
  const perms = ROLE_PERMISSIONS[role] || [];
  return perms.includes('*') || perms.includes(permission);
};
