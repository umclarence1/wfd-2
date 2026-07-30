/** Escape user input before embedding in a RegExp (ReDoS / injection). */
export const escapeRegex = (value) =>
  String(value ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
