export const OFFLINE_ACTION_MESSAGE = 'Internet connection is required for this action.';

export const OFFLINE_BANNER_MESSAGE =
  'You are currently offline. Some features are disabled.';

export function isOfflineError(error) {
  return Boolean(error?.isOffline || error?.code === 'ERR_NETWORK' && !navigator.onLine);
}

export function getOfflineAwareErrorMessage(error, fallback = 'Something went wrong.') {
  if (isOfflineError(error)) return OFFLINE_ACTION_MESSAGE;
  return error?.response?.data?.message || error?.message || fallback;
}
