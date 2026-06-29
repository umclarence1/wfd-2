import Checker from '../models/Checker.js';
import Package from '../models/Package.js';
import { AppError } from '../middleware/errorHandler.js';

const CHECKER_CATEGORY_MAP = {
  BECE: 'BECE Checker',
  WASSCE: 'WASSCE Checker',
};

export const getCheckerStats = async () => {
  const [beceTotal, beceUsed, wassceTotal, wassceUsed] = await Promise.all([
    Checker.countDocuments({ checkerType: 'BECE' }),
    Checker.countDocuments({ checkerType: 'BECE', status: 'used' }),
    Checker.countDocuments({ checkerType: 'WASSCE' }),
    Checker.countDocuments({ checkerType: 'WASSCE', status: 'used' }),
  ]);

  return {
    bece: { total: beceTotal, used: beceUsed, unused: beceTotal - beceUsed },
    wassce: { total: wassceTotal, used: wassceUsed, unused: wassceTotal - wassceUsed },
  };
};

export const checkStock = async (checkerType) => {
  const count = await Checker.countDocuments({ checkerType, status: 'unused' });
  return count > 0;
};

export const assignChecker = async (checkerType, orderId, session) => {
  const checker = await Checker.findOneAndUpdate(
    { checkerType, status: 'unused' },
    { status: 'used', order: orderId, usedAt: new Date() },
    { new: true, session, sort: { createdAt: 1 } }
  );

  if (!checker) {
    throw new AppError(
      'This checker is currently out of stock. Please check back later.',
      400,
      'OUT_OF_STOCK'
    );
  }

  return checker;
};

export const uploadCheckersFromExcel = async (rows) => {
  const report = { total: rows.length, uploaded: 0, duplicatesSkipped: 0, invalidRows: 0, errors: [] };

  const existingSerials = new Set(
    (await Checker.find({}, 'serialNumber')).map((c) => c.serialNumber)
  );

  const toInsert = [];
  const seenSerials = new Set();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const checkerType = String(row['Checker Type'] || row.checkerType || '').trim().toUpperCase();
    const serialNumber = String(row['Serial Number'] || row.serialNumber || '').trim();
    const pin = String(row.PIN || row.pin || '').trim();
    const year = String(row.Year || row.year || '').trim();
    const status = String(row.Status || row.status || 'unused').trim().toLowerCase();

    if (!checkerType || !serialNumber || !pin || !year) {
      report.invalidRows++;
      report.errors.push({ row: i + 2, reason: 'Empty required field' });
      continue;
    }

    if (!['BECE', 'WASSCE'].includes(checkerType)) {
      report.invalidRows++;
      report.errors.push({ row: i + 2, reason: 'Invalid checker type' });
      continue;
    }

    if (existingSerials.has(serialNumber) || seenSerials.has(serialNumber)) {
      report.duplicatesSkipped++;
      continue;
    }

    seenSerials.add(serialNumber);
    toInsert.push({
      checkerType,
      serialNumber,
      pin,
      year,
      status: status === 'used' ? 'used' : 'unused',
    });
  }

  if (toInsert.length > 0) {
    const result = await Checker.insertMany(toInsert, { ordered: false }).catch((err) => {
      if (err.code === 11000) {
        report.duplicatesSkipped += err.writeErrors?.length || 0;
        return err.insertedDocs || [];
      }
      throw err;
    });
    report.uploaded = Array.isArray(result) ? result.length : toInsert.length;
  }

  await syncCheckerPackageAvailability();
  return report;
};

export const syncCheckerPackageAvailability = async () => {
  const updates = await Promise.all(
    Object.entries(CHECKER_CATEGORY_MAP).map(async ([checkerType, category]) => {
      const inStock = await checkStock(checkerType);
      const result = await Package.updateMany(
        { category, serviceType: 'result_checker', isActive: true },
        { $set: { isAvailable: inStock } }
      );
      return { category, inStock, modifiedCount: result.modifiedCount };
    })
  );
  return updates;
};
