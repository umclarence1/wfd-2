/**
 * Automatic TopDeals retries are disabled.
 * One payment sends once. A refused or timed-out call stays put until admin Resubmit.
 */
export const retryQueuedProviderOrders = async () => ({
  retried: 0,
  delivered: 0,
  stillQueued: 0,
  results: [],
  disabled: true,
  message: 'Automatic provider retries are off. Use admin Resubmit to send an order again.',
});
