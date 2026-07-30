export const isPackageSellable = (pkg) =>
  pkg?.isActive !== false && pkg?.adminPaused !== true && pkg?.isAvailable !== false;

export const withPublicAvailability = (pkg, { inStock = true } = {}) => {
  // Checkers: admin on-sale = active + not paused; live stock comes from TopDealsGH.
  if (pkg?.serviceType === 'result_checker') {
    const sellable = pkg?.isActive !== false && pkg?.adminPaused !== true;
    const checkerInStock = inStock !== false;
    return {
      ...pkg,
      inStock: checkerInStock,
      isAvailable: sellable && checkerInStock,
      adminPaused: pkg.adminPaused === true,
    };
  }

  const sellable = isPackageSellable(pkg);
  return {
    ...pkg,
    inStock: true,
    isAvailable: sellable,
    adminPaused: pkg.adminPaused === true,
  };
};

export const pauseUpdate = { adminPaused: true, isAvailable: false };
export const resumeUpdate = { adminPaused: false, isAvailable: true };
