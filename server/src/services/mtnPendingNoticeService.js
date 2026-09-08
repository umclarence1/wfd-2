/** MTN verification notice emails are disabled — customers are not emailed about MTN pending status. */
export const MTN_PENDING_NOTICE_MS = 90 * 60 * 1000;

export const notifyStaleMtnPendingOrders = async () => ({
  checked: 0,
  emailed: 0,
  errors: 0,
  disabled: true,
});
