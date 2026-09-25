import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { usePackagesByCategory } from '../../hooks/usePackages';
import api, { ensureCsrfToken } from '../../api/client';
import {
  validateNetworkPhone,
  normalizePhone,
  restrictPhoneInput,
  calculatePaymentBreakdown,
  formatCurrency,
} from '../../utils/validation';
import { useToast } from '../../context/ToastContext';
import { useOnlineStatus } from '../../context/OnlineContext';
import { getOfflineAwareErrorMessage, OFFLINE_ACTION_MESSAGE } from '../../utils/offline';
import PackageSelector from './PackageSelector';
import PackageImage from './PackageImage';
import { WAEC_IMAGE } from '../../constants/packageImages';
import { getNetworkBrandColors } from '../../constants/networkColors';
import FormError, { fieldClass } from '../ui/FormError';
import { usePurchaseFormKeyboard } from '../../hooks/usePurchaseFormKeyboard';
import { Loader2 } from 'lucide-react';

const buyLabelWhenIdle = ({
  isOnline,
  packageId,
  phoneValidation,
  isChecker,
  showAfaForm,
}) => {
  if (!isOnline) return 'Offline — payment unavailable';
  if (!packageId) {
    if (isChecker) return 'Select exam type';
    if (showAfaForm) return 'Loading package…';
    return 'Select data size';
  }
  if (!phoneValidation.valid) return 'Enter valid phone number';
  if (isChecker || showAfaForm) return 'Buy Now';
  return 'BUY';
};

export default function PurchaseForm({
  category,
  serviceType,
  showAfaForm = false,
  title,
  checkerExamType,
  checkerExamOptions,
  onCheckerExamTypeChange,
  packagesOverride = null,
}) {
  const isChecker = Boolean(checkerExamOptions?.length);
  const brand = getNetworkBrandColors(isChecker ? 'WAEC Checkers' : category);
  const [selected, setSelected] = useState(null);
  const quantity = 1;
  const [phone, setPhone] = useState('');
  const [promoCode, setPromoCode] = useState('');
  const [promoApplied, setPromoApplied] = useState('');
  const [breakdown, setBreakdown] = useState(null);
  const [loadingBreakdown, setLoadingBreakdown] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const submitLock = useRef(false);
  const [errors, setErrors] = useState({});

  const { toast } = useToast();
  const { isOnline } = useOnlineStatus();
  const navigate = useNavigate();
  const { formRef, keyboardInset, onFieldFocus } = usePurchaseFormKeyboard();

  useEffect(() => {
    ensureCsrfToken().catch(() => {});
  }, []);
  const { packages: afaPackages, isFetching: afaLoading } = usePackagesByCategory('MTN AFA');
  const { packages: catalogPackages } = usePackagesByCategory(!isChecker ? category : '');

  const { data: siteSettings } = useQuery({
    queryKey: ['settings'],
    queryFn: () => api.get('/public/settings').then((r) => r.data.settings),
    staleTime: 30_000,
    placeholderData: {},
  });

  const showPromoField = siteSettings?.promoCheckoutEnabled === true;

  const clearError = (field) => {
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const { packages: checkerPackagesFromApi } = usePackagesByCategory(isChecker && !packagesOverride?.length ? category : '');
  const checkerPackages = packagesOverride?.length ? packagesOverride : checkerPackagesFromApi;

  const handleSelectPackage = useCallback((pkg) => {
    setSelected(pkg);
    const qty = isChecker ? quantity : 1;
    setBreakdown(calculatePaymentBreakdown(pkg.price * qty));
  }, [isChecker, quantity]);

  // Auto-pick the checker package when an exam type is chosen (single-page flow).
  useEffect(() => {
    if (!isChecker) return;
    if (!category) {
      setSelected(null);
      setBreakdown(null);
      return;
    }
    const available = checkerPackages.filter(
      (p) => p.isActive !== false && p.isAvailable !== false
    );
    if (!available.length) {
      setSelected(null);
      setBreakdown(null);
      return;
    }
    const next = available[0];
    if (selected?._id !== next._id) {
      handleSelectPackage(next);
    }
  }, [isChecker, category, checkerPackages, selected?._id, handleSelectPackage]);

  useEffect(() => {
    if (showPromoField) return;
    setPromoCode('');
    setPromoApplied('');
    if (selected) {
      setBreakdown(calculatePaymentBreakdown(selected.price * (isChecker ? quantity : 1)));
    }
  }, [showPromoField, selected, quantity, isChecker]);

  useEffect(() => {
    if (!isChecker || !selected) return;
    setBreakdown(calculatePaymentBreakdown(selected.price * quantity));
  }, [quantity, isChecker, selected]);

  useEffect(() => {
    if (!showAfaForm || selected) return;

    const source = packagesOverride || afaPackages;
    const available = source.filter((p) => p.isActive !== false && p.isAvailable !== false);
    const registration =
      available.find((p) => p.afaType === 'new') ||
      available.find((p) => /registration/i.test(p.name)) ||
      available[0];

    if (registration) handleSelectPackage(registration);
  }, [showAfaForm, afaPackages, packagesOverride, selected, handleSelectPackage]);

  useEffect(() => {
    if (!selected || !promoApplied) return;

    const fetchBreakdown = async () => {
      setLoadingBreakdown(true);
      try {
        const { data } = await api.post(`/packages/${selected._id}/breakdown`, {
          promoCode: promoApplied,
          phone: normalizePhone(phone),
        });
        setBreakdown(data.breakdown);
      } catch {
        setBreakdown(calculatePaymentBreakdown(selected.price));
        setPromoApplied('');
      } finally {
        setLoadingBreakdown(false);
      }
    };

    fetchBreakdown();
  }, [selected, promoApplied, phone]);

  const handleApplyPromo = async () => {
    if (!promoCode.trim() || !selected) return;

    if (!isOnline) {
      toast(OFFLINE_ACTION_MESSAGE, 'error');
      return;
    }

    const phoneResult = validateNetworkPhone(phone, isChecker ? null : category);
    if (!phoneResult.valid) {
      setErrors((prev) => ({ ...prev, phone: phoneResult.error }));
      toast(phoneResult.error, 'error');
      return;
    }

    setLoadingBreakdown(true);
    try {
      const breakdownPackageId = selected?._id || selected?.id;
      const { data } = await api.post(`/packages/${breakdownPackageId}/breakdown`, {
        promoCode: promoCode.trim(),
        phone: phoneResult.normalized,
      });
      setBreakdown(data.breakdown);
      setPromoApplied(promoCode.trim());
      toast('Promo code applied!', 'success');
    } catch (err) {
      toast(getOfflineAwareErrorMessage(err, 'Invalid or expired promo code.'), 'error');
      setPromoApplied('');
    } finally {
      setLoadingBreakdown(false);
    }
  };

  const packageId = selected?._id || selected?.id;

  const phoneValidation = useMemo(
    () => validateNetworkPhone(phone, isChecker ? null : category),
    [phone, category, isChecker]
  );

  const purchaseReady = Boolean(packageId) && phoneValidation.valid;

  const validate = () => {
    const newErrors = {};
    if (!packageId) {
      newErrors.package = isChecker
        ? 'Please select an exam type.'
        : 'Please select a data size.';
    }

    if (!phoneValidation.valid) {
      newErrors.phone = phoneValidation.error;
    }

    setErrors(newErrors);
    const firstMessage = newErrors.package || newErrors.phone;
    return { ok: Object.keys(newErrors).length === 0, firstMessage };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isOnline) {
      toast(OFFLINE_ACTION_MESSAGE, 'error');
      return;
    }
    const validation = validate();
    if (!validation.ok) {
      toast(validation.firstMessage || 'Please check your details.', 'error');
      return;
    }

    if (submitLock.current) return;
    submitLock.current = true;
    setSubmitting(true);
    let checkoutInProgress = false;
    try {
      const payload = {
        packageId,
        phone: phoneValidation.normalized || normalizePhone(phone),
        quantity: isChecker ? quantity : 1,
        promoCode: promoApplied || undefined,
      };

      const idempotencyStorageKey = `wds-pay-${phoneValidation.normalized || normalizePhone(phone)}-${packageId}`;
      let idempotencyKey = sessionStorage.getItem(idempotencyStorageKey);
      if (!idempotencyKey) {
        idempotencyKey = globalThis.crypto?.randomUUID?.() || `ord-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        sessionStorage.setItem(idempotencyStorageKey, idempotencyKey);
      }
      const { data: body } = await api.post('/orders/create', payload, {
        headers: { 'Idempotency-Key': idempotencyKey },
        timeout: 60000,
      });

      if (!body?.success) {
        toast(body?.message || 'Could not start checkout. Please try again.', 'error');
        return;
      }

      const order = body.order;
      const checkout = body.checkout;
      const payment = body.payment;

      if (order?.isFreeOrder && order.reference) {
        checkoutInProgress = true;
        toast('Order completed successfully!', 'success');
        navigate(`/payment/callback?reference=${order.paymentReference || order.reference}`);
        return;
      }

      if (order?.alreadyPaid && order.reference) {
        checkoutInProgress = true;
        toast('Payment already completed.', 'success');
        navigate(`/payment/callback?reference=${order.paymentReference || order.reference}`);
        return;
      }

      const payUrl = payment?.authorizationUrl;
      const paymentReference = checkout?.paymentReference || order?.paymentReference;

      if (payUrl) {
        checkoutInProgress = true;
        if (paymentReference) {
          sessionStorage.setItem('wds_payment_reference', paymentReference);
        }
        window.location.assign(payUrl);
        return;
      }

      toast(body?.message || 'Could not start payment. Please try again.', 'error');
    } catch (err) {
      toast(getOfflineAwareErrorMessage(err, 'Failed to create order.'), 'error');
    } finally {
      if (!checkoutInProgress) {
        submitLock.current = false;
        setSubmitting(false);
      }
    }
  };

  const idleBuyLabel = buyLabelWhenIdle({
    isOnline,
    packageId,
    phoneValidation,
    isChecker,
    showAfaForm,
  });

  const isSinglePage = !isChecker;

  const buyButtonClass =
    category === 'MTN' || category === 'MTN EXPRESS' || category === 'MTN AFA'
      ? 'w-full rounded-lg border border-[#FFCB05] bg-[#FFCB05] py-3.5 text-base font-bold text-gray-900 shadow-sm transition hover:bg-[#e6b800] disabled:opacity-50'
      : category === 'Telecel'
        ? 'w-full rounded-lg border border-[#E40520] bg-[#E40520] py-3.5 text-base font-bold text-white shadow-sm transition hover:bg-[#c9041c] disabled:opacity-50'
        : 'btn-primary w-full !py-3.5';

  const phoneField = (
    <div>
      <label className="mb-1.5 block text-sm font-semibold text-gray-800">
        Beneficiary Phone Number <span className="text-red-600">*</span>
      </label>
      <input
        className={fieldClass(errors.phone, brand.inputFocus)}
        value={phone}
        disabled={submitting}
        onChange={(e) => {
          setPhone(restrictPhoneInput(e.target.value));
          clearError('phone');
        }}
        onFocus={onFieldFocus}
        placeholder="enter number here (0598104488)"
        inputMode="numeric"
        maxLength={10}
        autoComplete="tel"
        enterKeyHint="done"
      />
      <FormError message={errors.phone} />
    </div>
  );

  if (isChecker) {
    const examOptions = checkerExamOptions || [];
    return (
      <div
        ref={formRef}
        className="mx-auto max-w-md px-4 py-6 sm:py-8"
        style={keyboardInset ? { paddingBottom: keyboardInset + 40 } : undefined}
      >
        <div className="flex items-center gap-3">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-gray-200 bg-white p-1.5 sm:h-16 sm:w-16">
            <img src={WAEC_IMAGE} alt="WAEC" className="h-full w-full object-contain" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-gray-900 sm:text-2xl">
            {title || 'Result Checker'}
          </h1>
        </div>

        <form noValidate onSubmit={handleSubmit} className="mt-7 space-y-6">
          <div>
            <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
              Exam type
            </h2>
            <div className={`grid gap-3 ${examOptions.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
              {examOptions.map(({ id, label }) => {
                const active = checkerExamType === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => onCheckerExamTypeChange?.(id)}
                    className={`h-11 w-full rounded-lg border text-sm font-bold uppercase tracking-wide transition ${
                      active
                        ? 'border-gray-800 bg-white text-gray-900 shadow-sm ring-1 ring-gray-800'
                        : 'border-gray-300 bg-white text-gray-900 hover:border-gray-400'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            <FormError message={errors.package} />
          </div>

          <div>
            <h2 className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
              Price
            </h2>
            <p className="text-2xl font-bold tracking-tight text-gray-900">
              {selected ? formatCurrency((breakdown?.total ?? selected.price * quantity) || 0) : '—'}
            </p>
          </div>

          {phoneField}

          {showPromoField && (
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Promo Code (Optional)</label>
              <div className="flex gap-2">
                <input
                  className="input-field"
                  value={promoCode}
                  onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                  onFocus={onFieldFocus}
                  placeholder="PROMO123"
                />
                <button
                  type="button"
                  onClick={handleApplyPromo}
                  disabled={!isOnline}
                  className="btn-secondary shrink-0"
                >
                  Apply
                </button>
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={submitting || !isOnline || !purchaseReady}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#8caf94] py-3.5 text-base font-bold uppercase tracking-wide text-white shadow-sm transition hover:bg-[#7da285] disabled:opacity-50"
          >
            {submitting && <Loader2 className="h-5 w-5 animate-spin" aria-hidden />}
            {submitting ? 'Processing…' : idleBuyLabel}
          </button>
        </form>
      </div>
    );
  }

  if (isSinglePage) {
    if (showAfaForm && afaLoading && !selected) {
      return (
        <div ref={formRef} className="mx-auto max-w-md px-4 py-10">
          <p className="text-sm text-gray-500">Loading AFA registration...</p>
        </div>
      );
    }

    if (showAfaForm && !afaLoading && !selected) {
      return (
        <div ref={formRef} className="mx-auto max-w-md px-4 py-10">
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-center text-sm font-semibold text-red-800">
            MTN AFA registration is currently unavailable. Please check back later.
          </div>
        </div>
      );
    }

    const priceRange = (() => {
      if (showAfaForm) return null;
      const source = packagesOverride || catalogPackages || [];
      const list = source.filter((p) => p.isActive !== false && p.isAvailable !== false);
      if (!list.length) return null;
      const prices = list.map((p) => Number(p.price)).filter((n) => Number.isFinite(n));
      if (!prices.length) return null;
      const min = Math.min(...prices);
      const max = Math.max(...prices);
      return min === max ? formatCurrency(min) : `${formatCurrency(min)} – ${formatCurrency(max)}`;
    })();

    return (
      <div
        ref={formRef}
        className="mx-auto max-w-md px-4 py-6 sm:py-8"
        style={keyboardInset ? { paddingBottom: keyboardInset + 40 } : undefined}
      >
        {showAfaForm && (
          <>
            <div className="flex items-center gap-3 sm:gap-4">
              <PackageImage category={category} title={title} size="banner" />
              <div className="min-w-0">
                <h1 className="text-xl font-bold tracking-tight text-gray-900 sm:text-2xl">{title}</h1>
              </div>
            </div>
            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-900">
              Registration takes about 24 hours. Dial *1848# to check status.
            </div>
          </>
        )}

        {priceRange && !showAfaForm && (
          <p className="text-sm font-medium text-gray-500">{priceRange}</p>
        )}

        <form noValidate onSubmit={handleSubmit} className={showAfaForm ? 'mt-6 space-y-5' : 'mt-5 space-y-5'}>
          {!showAfaForm && (
            <div>
              <h2 className="mb-2 text-[11px] font-bold uppercase tracking-wide text-gray-500">
                Data size
              </h2>
              <PackageSelector
                category={category}
                selected={selected}
                onSelect={handleSelectPackage}
                packagesOverride={packagesOverride}
              />
              <FormError message={errors.package} />
            </div>
          )}

          <div>
            <h2 className="mb-1 text-[11px] font-bold uppercase tracking-wide text-gray-500">Price</h2>
            <p className="text-3xl font-bold tracking-tight text-gray-900">
              {selected
                ? formatCurrency((breakdown?.total ?? selected.price) || 0)
                : '—'}
            </p>
            {breakdown?.discount > 0 && (
              <p className="mt-1 text-xs font-medium text-emerald-700">
                Promo saved {formatCurrency(breakdown.discount)}
              </p>
            )}
          </div>

          {phoneField}

          {showPromoField && (
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Promo Code (Optional)</label>
              <div className="flex gap-2">
                <input
                  className="input-field"
                  value={promoCode}
                  onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                  onFocus={onFieldFocus}
                  placeholder="PROMO123"
                />
                <button
                  type="button"
                  onClick={handleApplyPromo}
                  disabled={!isOnline}
                  className="btn-secondary shrink-0"
                >
                  Apply
                </button>
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={submitting || !isOnline || !purchaseReady}
            className={`flex items-center justify-center gap-2 ${buyButtonClass}`}
          >
            {submitting && <Loader2 className="h-5 w-5 animate-spin" aria-hidden />}
            {submitting ? 'Processing…' : idleBuyLabel}
          </button>
        </form>
      </div>
    );
  }

  return null;
}
