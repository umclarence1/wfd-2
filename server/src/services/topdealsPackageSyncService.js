import Package from '../models/Package.js';
import { getProviderCredentials, isTopDealsGhConfigured } from './apiProviderService.js';
import { PROVIDER_IDS } from '../config/apiProviders.js';
import { resolveTopDealsGhPackageId } from './providers/topdealsghProvider.js';

/** Map local packages to TopDealsGH package IDs so orders submit reliably. */
export const syncTopDealsPackageIds = async () => {
  if (!(await isTopDealsGhConfigured())) {
    return { synced: 0, matched: 0, failed: 0, skipped: true };
  }

  const creds = await getProviderCredentials(PROVIDER_IDS.TOPDEALSGH);
  const packages = await Package.find({
    serviceType: 'data_bundle',
    isActive: true,
    adminPaused: { $ne: true },
  });

  let synced = 0;
  let matched = 0;
  let failed = 0;

  for (const pkg of packages) {
    try {
      const topdealsId = await resolveTopDealsGhPackageId(creds, pkg);
      matched += 1;
      if (topdealsId && pkg.providerPackageId !== topdealsId) {
        await Package.updateOne({ _id: pkg._id }, { $set: { providerPackageId: topdealsId } });
        synced += 1;
      }
    } catch (err) {
      failed += 1;
      console.warn(
        `[TOPDEALS_PKG_SYNC] No match: ${pkg.category} ${pkg.dataAmount || pkg.name} — ${err.message}`
      );
    }
  }

  if (synced || failed) {
    console.log(`[TOPDEALS_PKG_SYNC] matched=${matched} updated=${synced} failed=${failed}`);
  }

  return { synced, matched, failed, total: packages.length, skipped: false };
};
