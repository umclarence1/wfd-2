export const ADMIN_ROLES = ['admin', 'super_admin', 'support'];

export const ROLE_PERMISSIONS = {
  super_admin: ['*'],
  admin: [
    'packages',
    'orders',
    'promos',
    'sliders',
    'analytics',
    'api_providers',
    'promo_checkout',
    'settings',
    'users',
  ],
  support: ['orders', 'analytics'],
};

export const hasPermission = (role, permission) => {
  const perms = ROLE_PERMISSIONS[role] || [];
  return perms.includes('*') || perms.includes(permission);
};
