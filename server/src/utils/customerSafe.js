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
  checkersSalesEnabled: settings.checkersSalesEnabled === true,
  paystackPublicKey: settings.paystackPublicKey || process.env.PAYSTACK_PUBLIC_KEY || '',
});

/** Customer-facing delivery status prefers the latest TopDeals report over local admin marks. */
export const resolveCustomerDeliveryStatus = (order) => {
  if (!order) return 'processing';

  const rawCandidates = [
    order.metadata?.lastProviderStatus,
    order.providerResponse?.lastWebhook?.providerStatus,
    order.providerResponse?.lastWebhook?.status,
    order.providerResponse?.lastStatusCheck?.data?.status,
    order.providerResponse?.lastStatusCheck?.status,
    order.providerResponse?.raw?.data?.status,
  ]
    .map((value) => String(value || '').trim().toLowerCase())
    .filter(Boolean);

  for (const candidate of rawCandidates) {
    if (['delivered', 'completed', 'success'].includes(candidate)) return 'delivered';
    if (['failed', 'cancelled', 'canceled', 'refunded'].includes(candidate)) {
      return candidate === 'canceled' ? 'cancelled' : candidate;
    }
    if (['verification', 'verifying', 'number_verification', 'verify'].includes(candidate)) {
      return 'verification';
    }
    if (['processing', 'pending', 'queued', 'submitting'].includes(candidate)) return 'processing';
  }

  const local = String(order.deliveryStatus || '').toLowerCase();
  if (['failed', 'cancelled', 'refunded', 'verification'].includes(local)) return local;

  // Local "delivered" is set when TopDeals accepts the order; until TopDeals reports
  // completed, customers should see processing.
  if (
    local === 'delivered'
    && (
      order.metadata?.providerReportedDelivered === true
      || ['delivered', 'completed', 'success'].includes(String(order.metadata?.lastProviderStatus || '').toLowerCase())
    )
  ) {
    return 'delivered';
  }

  return 'processing';
};

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
    deliveryStatus: resolveCustomerDeliveryStatus(order),
    createdAt: order.createdAt,
  };

  if (order.paymentStatus === 'paid' && order.paymentReference) {
    safe.paymentReference = order.paymentReference;
  }

  const dataAmount =
    order.package?.dataAmount ||
    order.dataAmount ||
    null;
  if (dataAmount) safe.dataAmount = dataAmount;

  if (includePhone) {
    safe.phone = order.phone;
  }

  if (includeChecker && order.paymentStatus === 'paid') {
    const populatedCheckers =
      Array.isArray(order.checkers) && order.checkers.length
        ? order.checkers
        : order.checker
          ? [order.checker]
          : [];

    safe.checkers = populatedCheckers
      .filter((checker) => checker?.serialNumber && checker?.pin)
      .map((checker) => ({
        checkerType: checker.checkerType,
        serialNumber: checker.serialNumber,
        pin: checker.pin,
      }));

    // Backward compatibility for clients expecting a singular checker.
    if (safe.checkers.length) {
      [safe.checker] = safe.checkers;
    }
  }

  return safe;
};
