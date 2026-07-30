const PROVIDER_NAME_PATTERN = /datamax|topdealsgh|top\s*deals\s*gh|smart\s*data\s*hub|smart_data_hub/gi;

export const sanitizeCustomerMessage = (message) => {
  if (!message || typeof message !== 'string') return message;
  return message.replace(PROVIDER_NAME_PATTERN, 'our delivery service').trim();
};

export const toPublicSiteSettings = (settings = {}) => ({
  siteName: settings.siteName,
  tagline: settings.tagline,
  logo: settings.logo,
  favicon: settings.favicon,
  contactPhone: settings.contactPhone,
  whatsapp: settings.whatsapp,
  address: settings.address,
  socialLinks: settings.socialLinks,
  maintenanceMode: settings.maintenanceMode,
  maintenanceMessage: settings.maintenanceMessage,
  announcementBanner: settings.announcementBanner,
  stats: settings.stats,
  promoCheckoutEnabled: settings.promoCheckoutEnabled,
  paystackPublicKey: settings.paystackPublicKey || process.env.PAYSTACK_PUBLIC_KEY || '',
});

export const sanitizeOrderForCustomer = (order, { includeChecker = false, includePhone = false } = {}) => {
  if (!order) return null;

  const safe = {
    reference: order.reference,
    packageName: order.packageName,
    category: order.category,
    serviceType: order.serviceType,
    packagePrice: order.packagePrice,
    totalAmount: order.totalAmount,
    paymentStatus: order.paymentStatus,
    deliveryStatus: order.deliveryStatus,
    createdAt: order.createdAt,
  };

  if (includePhone) {
    safe.phone = order.phone;
  }

  if (includeChecker && order.paymentStatus === 'paid' && order.checker) {
    safe.checker = {
      checkerType: order.checker.checkerType,
      serialNumber: order.checker.serialNumber,
      pin: order.checker.pin,
    };
  }

  return safe;
};
