import { normalizePhone } from '../../utils/validation.js';

/** Ghana local format: 0XXXXXXXXX (10 digits) */
export const formatGhanaLocalPhone = (phone) => {
  let digits = normalizePhone(phone);
  if (digits.startsWith('233') && digits.length === 12) {
    digits = `0${digits.slice(3)}`;
  }
  if (digits.length === 9) {
    digits = `0${digits}`;
  }
  return digits;
};

/** Parse package data amount into a numeric GB string (e.g. "1", "2.5"). */
export const parseBundleVolume = (dataAmount) => {
  const raw = String(dataAmount || '').trim().toUpperCase();
  const gbMatch = raw.match(/^(\d+(?:\.\d+)?)\s*GB$/);
  if (gbMatch) return gbMatch[1];

  const mbMatch = raw.match(/^(\d+(?:\.\d+)?)\s*MB$/);
  if (mbMatch) {
    const gb = Number(mbMatch[1]) / 1024;
    return String(Number.isInteger(gb) ? gb : gb.toFixed(2));
  }

  const numeric = raw.match(/(\d+(?:\.\d+)?)/);
  return numeric ? numeric[1] : '1';
};

/** Normalize bundle labels for matching (1GB, 1 GB, 1.0GB → 1GB). */
export const normalizeBundleLabel = (value) => {
  const raw = String(value || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '');
  if (!raw) return '';
  const gb = raw.match(/^(\d+(?:\.\d+)?)GB$/);
  if (gb) {
    const n = Number(gb[1]);
    return `${Number.isInteger(n) ? n : n}GB`;
  }
  const mb = raw.match(/^(\d+(?:\.\d+)?)MB$/);
  if (mb) return `${mb[1]}MB`;
  const num = raw.match(/^(\d+(?:\.\d+)?)$/);
  if (num) return `${Number(num[1])}GB`;
  return raw;
};
