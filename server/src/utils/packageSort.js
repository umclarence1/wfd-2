import Package from '../models/Package.js';

export const parseDataAmountMb = (dataAmount) => {
  const raw = String(dataAmount || '').trim().toUpperCase();
  const tbMatch = raw.match(/^(\d+(?:\.\d+)?)\s*TB$/);
  if (tbMatch) return Number(tbMatch[1]) * 1024 * 1024;

  const gbMatch = raw.match(/^(\d+(?:\.\d+)?)\s*GB$/);
  if (gbMatch) return Number(gbMatch[1]) * 1024;

  const mbMatch = raw.match(/^(\d+(?:\.\d+)?)\s*MB$/);
  if (mbMatch) return Number(mbMatch[1]);

  const numeric = raw.match(/(\d+(?:\.\d+)?)/);
  return numeric ? Number(numeric[1]) : 0;
};

export const comparePackagesAscending = (a, b) => {
  if (a.serviceType === 'data_bundle' && b.serviceType === 'data_bundle') {
    const sizeDiff = parseDataAmountMb(a.dataAmount) - parseDataAmountMb(b.dataAmount);
    if (sizeDiff !== 0) return sizeDiff;
  }

  const priceDiff = (a.price || 0) - (b.price || 0);
  if (priceDiff !== 0) return priceDiff;

  return String(a.name || '').localeCompare(String(b.name || ''));
};

export const reorderCategoryPackages = async (category) => {
  if (!category) return [];

  const packages = await Package.find({ category }).lean();
  const sorted = [...packages].sort(comparePackagesAscending);

  await Promise.all(
    sorted.map((pkg, index) => Package.findByIdAndUpdate(pkg._id, { displayOrder: index }))
  );

  return sorted;
};
