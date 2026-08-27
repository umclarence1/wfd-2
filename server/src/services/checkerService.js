import Package from '../models/Package.js';
import {
  getProviderCredentials,
  isApiForwardingEnabled,
  isTopDealsGhConfigured,
} from './apiProviderService.js';
import { PROVIDER_IDS } from '../config/apiProviders.js';
import { getTopDealsGhCheckerOffers } from './providers/topdealsghProvider.js';

const CHECKER_CATEGORY_MAP = {
  BECE: 'BECE Checker',
  WASSCE: 'WASSCE Checker',
};

export const DEFAULT_CHECKER_PACKAGES = [
  {
    name: 'BECE Result Checker',
    category: 'BECE Checker',
    price: 17,
    serviceType: 'result_checker',
    checkerType: 'BECE',
    displayOrder: 0,
    isActive: true,
    isAvailable: true,
    adminPaused: false,
  },
  {
    name: 'WASSCE Result Checker',
    category: 'WASSCE Checker',
    price: 17,
    serviceType: 'result_checker',
    checkerType: 'WASSCE',
    displayOrder: 0,
    isActive: true,
    isAvailable: true,
    adminPaused: false,
  },
];

const normalizeCheckerType = (value) => {
  const raw = String(value || '').toLowerCase().trim();
  if (raw === 'bece') return 'BECE';
  if (raw === 'wassce' || raw === 'waec') return 'WASSCE';
  return String(value || '').toUpperCase();
};

const findCheckerOffer = (offers, checkerType) => {
  const want = normalizeCheckerType(checkerType);
  return (offers || []).find((o) => normalizeCheckerType(o.type) === want);
};

let checkerOffersCache = { at: 0, data: null };
const CHECKER_OFFERS_TTL_MS = 5 * 60_000;
const CHECKER_OFFERS_STALE_MS = 30 * 60_000;

const getCachedCheckerOffers = async (creds, { allowStale = false } = {}) => {
  const now = Date.now();
  const age = now - checkerOffersCache.at;
  if (checkerOffersCache.data && age < CHECKER_OFFERS_TTL_MS) {
    return checkerOffersCache.data;
  }

  // Serve slightly stale stock immediately and refresh in the background.
  if (allowStale && checkerOffersCache.data && age < CHECKER_OFFERS_STALE_MS) {
    getTopDealsGhCheckerOffers(creds)
      .then((data) => {
        checkerOffersCache = { at: Date.now(), data };
      })
      .catch(() => {});
    return checkerOffersCache.data;
  }

  const data = await getTopDealsGhCheckerOffers(creds);
  checkerOffersCache = { at: now, data };
  return data;
};

export const clearCheckerOffersCache = () => {
  checkerOffersCache = { at: 0, data: null };
};

const offerInStock = (offer, quantity = 1) => {
  if (!offer) return false;
  if (offer.inStock === false) return false;
  const available = Number(offer.availableCount);
  if (Number.isFinite(available)) return available >= quantity;
  return true;
};

/** Map of checkerType (BECE/WASSCE) → in-stock boolean from TopDealsGH. */
export const getCheckerStockMap = async () => {
  const map = { BECE: false, WASSCE: false };
  if (!(await isApiForwardingEnabled()) || !(await isTopDealsGhConfigured())) {
    return map;
  }
  try {
    const creds = await getProviderCredentials(PROVIDER_IDS.TOPDEALSGH);
    const data = await getCachedCheckerOffers(creds);
    for (const offer of data.offers || []) {
      const type = normalizeCheckerType(offer.type);
      if (type === 'BECE' || type === 'WASSCE') {
        map[type] = offerInStock(offer, 1);
      }
    }
  } catch (err) {
    console.error('[CHECKER_STOCK] Could not load TopDealsGH offers:', err.message);
  }
  return map;
};

/** Stock is managed on TopDealsGH — not local unused inventory. */
export const resolveCheckerInStock = async (checkerType, quantity = 1) => {
  if (!(await isApiForwardingEnabled()) || !(await isTopDealsGhConfigured())) {
    return false;
  }
  try {
    const creds = await getProviderCredentials(PROVIDER_IDS.TOPDEALSGH);
    const data = await getCachedCheckerOffers(creds);
    const offer = findCheckerOffer(data.offers, checkerType);
    return offerInStock(offer, quantity);
  } catch {
    return false;
  }
};

/** Mirror TopDealsGH stock onto local checker packages (respects adminPaused). */
export const syncCheckerPackageAvailability = async () => {
  const stockMap = await getCheckerStockMap();
  const updates = [];

  for (const [checkerType, category] of Object.entries(CHECKER_CATEGORY_MAP)) {
    const inStock = stockMap[checkerType] === true;
    const result = await Package.updateMany(
      {
        category,
        serviceType: 'result_checker',
        isActive: true,
        adminPaused: { $ne: true },
      },
      { $set: { isAvailable: inStock } }
    );
    // Keep paused packages unavailable.
    await Package.updateMany(
      {
        category,
        serviceType: 'result_checker',
        adminPaused: true,
      },
      { $set: { isAvailable: false } }
    );
    updates.push({ category, checkerType, inStock, modifiedCount: result.modifiedCount });
  }

  return updates;
};

/** Create missing checker packages and keep them on sale (stock still mirrors TopDealsGH). */
export const ensureCheckerPackages = async () => {
  for (const defaults of DEFAULT_CHECKER_PACKAGES) {
    const existing = await Package.findOne({
      serviceType: 'result_checker',
      checkerType: defaults.checkerType,
    });
    if (!existing) {
      await Package.create(defaults);
      continue;
    }
    if (existing.adminPaused) {
      existing.adminPaused = false;
      await existing.save();
    }
  }
};
