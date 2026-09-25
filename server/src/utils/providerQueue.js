export const QUEUE_REASONS = {
  INSUFFICIENT_BALANCE: 'insufficient_balance',
  FORWARDING_OFF: 'forwarding_off',
  NETWORK_OFF: 'network_off',
};

/** Only these reasons use admin "queued" (wallet/config — retry when funded). */
export const isWalletOrConfigQueueReason = (reason) =>
  reason === QUEUE_REASONS.INSUFFICIENT_BALANCE
  || reason === QUEUE_REASONS.FORWARDING_OFF
  || reason === QUEUE_REASONS.NETWORK_OFF;

export const isInsufficientBalanceMessage = (message) => {
  const text = String(message || '').toLowerCase();
  return (
    text.includes('insufficient') &&
    (text.includes('balance') || text.includes('wallet') || text.includes('fund'))
  );
};

export const isInsufficientBalanceError = ({ message, errorCode, status } = {}) =>
  status === 402 ||
  errorCode === 'INSUFFICIENT_BALANCE' ||
  isInsufficientBalanceMessage(message);

export const asQueuedProviderResponse = (response, queueReason) => ({
  ...response,
  success: false,
  queued: true,
  queueReason,
  retryable: true,
});

export const markInsufficientBalanceIfNeeded = (response) => {
  if (response?.queued) return response;

  if (
    isInsufficientBalanceError({
      message: response?.message,
      errorCode: response?.errorCode || response?.raw?.error_code,
      status: response?.status,
    })
  ) {
    return asQueuedProviderResponse(response, QUEUE_REASONS.INSUFFICIENT_BALANCE);
  }

  return response;
};
