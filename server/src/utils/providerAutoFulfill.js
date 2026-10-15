/**
 * Only orders tagged for auto TopDeals fulfillment are sent/retried automatically.
 * Older stuck orders without this flag are left alone (admin Resubmit only).
 */
export const AUTO_PROVIDER_FULFILL_FLAG = 'autoProviderFulfill';

export const withAutoProviderFulfillMetadata = (metadata = {}) => ({
  ...metadata,
  [AUTO_PROVIDER_FULFILL_FLAG]: true,
});

export const isEligibleForAutoProviderFulfill = (order) =>
  Boolean(order?.metadata?.[AUTO_PROVIDER_FULFILL_FLAG] === true);
