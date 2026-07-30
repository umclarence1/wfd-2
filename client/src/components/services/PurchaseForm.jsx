import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { usePackagesByCategory } from '../../hooks/usePackages';
import api from '../../api/client';
import {
  validateNetworkPhone,
  validateGhanaCard,
  validateEmail,
  normalizePhone,
  restrictPhoneInput,
  calculatePaymentBreakdown,
  formatCurrency,
} from '../../utils/validation';
import { useToast } from '../../context/ToastContext';
import { useOnlineStatus } from '../../context/OnlineContext';
import { getOfflineAwareErrorMessage, OFFLINE_ACTION_MESSAGE } from '../../utils/offline';
import PackageSelector from './PackageSelector';
import PaymentBreakdown from './PaymentBreakdown';
import PackageImage from './PackageImage';
import { WAEC_IMAGE } from '../../constants/packageImages';
import { getNetworkBrandColors } from '../../constants/networkColors';
import FormError, { fieldClass } from '../ui/FormError';
import { usePurchaseFormKeyboard } from '../../hooks/usePurchaseFormKeyboard';

function SelectedPackageSummary({ selected, brand, quantity = 1 }) {
  const label = selected.dataAmount || selected.name;
  const lineTotal = (selected.price || 0) * quantity;
  return (
    <div className={`rounded-xl border p-4 ${brand.summaryBox}`}>
      <h2 className={`mb-3 text-sm font-bold tracking-tight ${brand.accent}`}>Your Package</h2>
      <p className="text-sm text-gray-800">
        Selected: <span className="font-bold text-gray-950">{label}</span>
      </p>
      {quantity > 1 && (
        <p className="mt-1 text-sm text-gray-800">
          Quantity: <span className="font-bold text-gray-950">{quantity}</span>
        </p>
      )}
      <p className="mt-1 text-sm text-gray-800">
        Price: <span className={`font-bold ${brand.accent}`}>{formatCurrency(lineTotal)}</span>
        {quantity > 1 && (
          <span className="ml-1 text-xs text-gray-500">({formatCurrency(selected.price)} each)</span>
        )}
      </p>
    </div>
  );
}

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
  const [step, setStep] = useState('select');
  const [selected, setSelected] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [promoCode, setPromoCode] = useState('');
  const [promoApplied, setPromoApplied] = useState('');
  const [breakdown, setBreakdown] = useState(null);
  const [loadingBreakdown, setLoadingBreakdown] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});
  const [afaDetails, setAfaDetails] = useState({ fullName: '', ghanaCard: '', location: '' });

  const { toast } = useToast();
  const { isOnline } = useOnlineStatus();
  const navigate = useNavigate();
  const { formRef, keyboardInset, onFieldFocus } = usePurchaseFormKeyboard();
  const { packages: afaPackages, isFetching: afaLoading } = usePackagesByCategory('MTN AFA');
  const { packages: catalogPackages } = usePackagesByCategory(
    !isChecker && !showAfaForm ? category : ''
  );

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

  const handleSelectPackage = useCallback((pkg) => {
    setSelected(pkg);
    const qty = isChecker ? quantity : 1;
    setBreakdown(calculatePaymentBreakdown(pkg.price * qty));
    if (isChecker) return;
    if (showAfaForm) setStep('checkout');
  }, [isChecker, quantity, showAfaForm]);

  const handleContinueChecker = () => {
    if (!selected) {
      toast('Please select an exam type first.', 'error');
      return;
    }
    setBreakdown(calculatePaymentBreakdown(selected.price * quantity));
    setStep('checkout');
  };

  const handleGoBack = () => {
    setStep('select');
    if (!isChecker) {
      setSelected(null);
      setBreakdown(null);
    }
    setPromoApplied('');
    setErrors({});
    if (isChecker && onCheckerExamTypeChange) {
      // keep exam type; allow changing quantity
    }
  };

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
          email,
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
  }, [selected, promoApplied, email, phone]);

  const handleApplyPromo = async () => {
    if (!promoCode.trim() || !selected) return;

    if (!isOnline) {
      toast(OFFLINE_ACTION_MESSAGE, 'error');
      return;
    }

    const emailResult = validateEmail(email);
    if (!emailResult.valid) {
      setErrors((prev) => ({ ...prev, email: emailResult.error }));
      toast(emailResult.error, 'error');
      return;
    }

    setLoadingBreakdown(true);
    try {
      const { data } = await api.post(`/packages/${selected._id}/breakdown`, {
        promoCode: promoCode.trim(),
        email,
        phone: normalizePhone(phone),
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

  const validate = () => {
    const newErrors = {};
    if (!selected) newErrors.package = 'Please select a package.';

    const emailResult = validateEmail(email);
    if (!emailResult.valid) newErrors.email = emailResult.error;

    const phoneResult = validateNetworkPhone(phone, category);
    if (!phoneResult.valid) newErrors.phone = phoneResult.error;

    if (showAfaForm) {
      if (!afaDetails.fullName || afaDetails.fullName.trim().length < 3) {
        newErrors.fullName = 'Full name must be at least 3 characters.';
      }
      const cardResult = validateGhanaCard(afaDetails.ghanaCard);
      if (!cardResult.valid) newErrors.ghanaCard = cardResult.error;
      if (!afaDetails.location.trim()) newErrors.location = 'Location is required.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isOnline) {
      toast(OFFLINE_ACTION_MESSAGE, 'error');
      return;
    }
    if (!validate()) {
      return;
    }

    setSubmitting(true);
    try {
      const emailResult = validateEmail(email);
      const payload = {
        packageId: selected._id,
        phone: normalizePhone(phone),
        email: emailResult.normalized,
        quantity: isChecker ? quantity : 1,
        promoCode: promoApplied || undefined,
        ...(showAfaForm && { afaDetails }),
      };

      sessionStorage.setItem('wds_order_email', emailResult.normalized);

      const idempotencyKey = globalThis.crypto?.randomUUID?.() || `ord-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const { data } = await api.post('/orders/create', payload, {
        headers: { 'Idempotency-Key': idempotencyKey },
      });

      if (data.order.isFreeOrder) {
        toast('Order completed successfully!', 'success');
        navigate(`/payment/callback?reference=${data.order.reference}&free=true`);
        return;
      }

      if (data.payment?.authorizationUrl) {
        window.location.href = data.payment.authorizationUrl;
      }
    } catch (err) {
      toast(getOfflineAwareErrorMessage(err, 'Failed to create order.'), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const isCheckout = step === 'checkout' && selected;
  const isSinglePage = !isChecker && !showAfaForm;

  const buyButtonClass =
    category === 'MTN' || category === 'MTN AFA'
      ? 'w-full rounded-lg border border-[#FFCB05] bg-[#FFCB05] py-3.5 text-base font-bold text-gray-900 shadow-sm transition hover:bg-[#e6b800] disabled:opacity-50'
      : category === 'Telecel'
        ? 'w-full rounded-lg border border-[#E40520] bg-[#E40520] py-3.5 text-base font-bold text-white shadow-sm transition hover:bg-[#c9041c] disabled:opacity-50'
        : 'btn-primary w-full !py-3.5';

  if (isSinglePage) {
    const priceRange = (() => {
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
        style={keyboardInset ? { paddingBottom: keyboardInset + 32 } : undefined}
      >
        {priceRange && (
          <p className="text-sm font-medium text-gray-500">{priceRange}</p>
        )}

        <form noValidate onSubmit={handleSubmit} className="mt-5 space-y-5">
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

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-900">
              Beneficiary Phone Number <span className="text-red-600">*</span>
            </label>
            <input
              className={fieldClass(errors.phone, brand.inputFocus)}
              value={phone}
              onChange={(e) => {
                setPhone(restrictPhoneInput(e.target.value));
                clearError('phone');
              }}
              onFocus={onFieldFocus}
              placeholder="enter number here"
              inputMode="numeric"
              maxLength={10}
              autoComplete="tel"
            />
            <FormError message={errors.phone} />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-900">
              Email <span className="text-red-600">*</span>
            </label>
            <input
              className={fieldClass(errors.email, brand.inputFocus)}
              type="text"
              inputMode="email"
              autoComplete="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                clearError('email');
              }}
              onFocus={onFieldFocus}
              onBlur={() => {
                if (!email.trim()) return;
                const result = validateEmail(email);
                if (!result.valid) {
                  setErrors((prev) => ({ ...prev, email: result.error }));
                }
              }}
              placeholder="enter email here"
            />
            <FormError message={errors.email} />
          </div>

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

          <button type="submit" disabled={submitting || !isOnline || !selected} className={buyButtonClass}>
            {submitting ? 'Processing...' : isOnline ? 'BUY' : 'Offline — payment unavailable'}
          </button>
        </form>

      </div>
    );
  }

  const detailsFields = (
    <div className="space-y-4">
      <div>
        <label className="mb-1.5 block text-sm font-medium text-gray-900">
          Beneficiary Phone Number <span className="text-red-600">*</span>
        </label>
        <input
          className={fieldClass(errors.phone, brand.inputFocus)}
          value={phone}
          onChange={(e) => {
            setPhone(restrictPhoneInput(e.target.value));
            clearError('phone');
          }}
          onFocus={onFieldFocus}
          placeholder="enter number here"
          inputMode="numeric"
          maxLength={10}
          autoComplete="tel"
        />
        <FormError message={errors.phone} />
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-medium text-gray-900">
          Email <span className="text-red-600">*</span>
        </label>
        <input
          className={fieldClass(errors.email, brand.inputFocus)}
          type="text"
          inputMode="email"
          autoComplete="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            clearError('email');
          }}
          onFocus={onFieldFocus}
          onBlur={() => {
            if (!email.trim()) return;
            const result = validateEmail(email);
            if (!result.valid) {
              setErrors((prev) => ({ ...prev, email: result.error }));
            }
          }}
          placeholder="enter email here"
        />
        <FormError message={errors.email} />
      </div>
      {showPromoField && (
        <div>
          <label className="mb-1 block text-sm font-medium">Promo Code (Optional)</label>
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
    </div>
  );

  return (
    <div
      ref={formRef}
      className="mx-auto max-w-lg px-4 py-8 sm:py-10"
      style={keyboardInset ? { paddingBottom: keyboardInset + 32 } : undefined}
    >
      <div className="flex items-center gap-3 sm:gap-4">
        {isChecker ? (
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-white p-1.5 shadow ring-1 ring-gray-200 sm:h-20 sm:w-20">
            <img src={WAEC_IMAGE} alt="WAEC" className="h-full w-full object-contain" />
          </div>
        ) : (
          <PackageImage category={category} title={title} size="banner" />
        )}
        <div className="min-w-0">
          <h1 className="text-xl font-bold tracking-tight text-gray-900 sm:text-2xl">{title}</h1>
          {step === 'select' && !showAfaForm && (
            <p className="mt-1 text-sm text-gray-600">
              {isChecker ? 'Select your exam type to continue.' : 'Select a package to continue.'}
            </p>
          )}
          {isCheckout && (
            <p className="mt-1 text-sm text-gray-600">Enter your details and proceed to payment.</p>
          )}
          {showAfaForm && step === 'select' && afaLoading && (
            <p className="mt-1 text-sm text-gray-600">Loading registration details...</p>
          )}
        </div>
      </div>

      <AnimatePresence>
        {showAfaForm && isCheckout && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-900"
          >
            Registration takes about 24 hours. Dial *1848# to check status.
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {step === 'select' && !showAfaForm && (
          <motion.div
            key="select-step"
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="mt-6"
          >
            <div className="flex flex-col gap-5 rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
              <h2 className="font-bold text-gray-900">Select Exam Type</h2>
              {isChecker && (
                <div className={`grid gap-3 ${checkerExamOptions.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
                  {checkerExamOptions.map(({ id, label }) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => onCheckerExamTypeChange(id)}
                      className={`pkg-box h-11 w-full text-sm ${
                        checkerExamType === id ? 'pkg-box-active border-blue-600 bg-blue-600 !text-white' : ''
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}
              {(!isChecker || checkerExamType) && (
                <PackageSelector
                  category={category}
                  selected={selected}
                  onSelect={handleSelectPackage}
                  summaryOnly={isChecker}
                  packagesOverride={packagesOverride}
                />
              )}
              {isChecker && selected && (
                <div>
                  <h3 className="mb-3 text-sm font-bold text-gray-900">How many checkers? (1–5)</h3>
                  <div className="grid grid-cols-5 gap-2">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setQuantity(n)}
                        className={`pkg-box ${quantity === n ? brand.boxActive || 'pkg-box-active' : brand.boxHover || ''}`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                  <p className="mt-3 text-sm text-gray-600">
                    Total:{' '}
                    <span className={`font-bold ${brand.accent}`}>
                      {formatCurrency(selected.price * quantity)}
                    </span>
                  </p>
                  <button type="button" onClick={handleContinueChecker} className="btn-primary mt-4 w-full">
                    Continue to payment
                  </button>
                </div>
              )}
              {errors.package && <FormError message={errors.package} />}
            </div>
          </motion.div>
        )}

        {showAfaForm && afaLoading && !selected && (
          <p className="mt-6 text-sm text-gray-500">Loading AFA registration...</p>
        )}

        {showAfaForm && !afaLoading && !selected && (
          <motion.div
            key="afa-unavailable"
            className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-600"
          >
            MTN AFA registration is currently unavailable. Please check back later.
          </motion.div>
        )}

        {isCheckout && (
          <motion.form
            key="checkout-step"
            noValidate
            onSubmit={handleSubmit}
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 16 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="mt-6 flex flex-col gap-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:gap-5 sm:p-5"
          >
            {!showAfaForm && (
              <button type="button" onClick={handleGoBack} className="btn-back self-start">
                {isChecker ? 'Change selection' : 'Change package'}
              </button>
            )}

            <SelectedPackageSummary selected={selected} brand={brand} quantity={isChecker ? quantity : 1} />

            {showAfaForm && (
              <div className="flex flex-col gap-3 border-t border-gray-100 pt-4">
                <h2 className="font-bold text-gray-900">Registration Details</h2>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-900">Full Name</label>
                  <input
                    className={fieldClass(errors.fullName, brand.inputFocus)}
                    value={afaDetails.fullName}
                    onChange={(e) => {
                      setAfaDetails({ ...afaDetails, fullName: e.target.value });
                      clearError('fullName');
                    }}
                    onFocus={onFieldFocus}
                    placeholder="Your full name"
                    autoComplete="name"
                  />
                  <FormError message={errors.fullName} />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-900">Ghana Card Number</label>
                  <input
                    className={fieldClass(errors.ghanaCard, brand.inputFocus)}
                    value={afaDetails.ghanaCard}
                    onChange={(e) => {
                      setAfaDetails({ ...afaDetails, ghanaCard: e.target.value.toUpperCase() });
                      clearError('ghanaCard');
                    }}
                    onFocus={onFieldFocus}
                    placeholder="GHA-123456789-0"
                  />
                  <FormError message={errors.ghanaCard} />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-900">Location</label>
                  <input
                    className={fieldClass(errors.location, brand.inputFocus)}
                    value={afaDetails.location}
                    onChange={(e) => {
                      setAfaDetails({ ...afaDetails, location: e.target.value });
                      clearError('location');
                    }}
                    onFocus={onFieldFocus}
                    placeholder="Takoradi, Kumasi, Sunyani..."
                  />
                  <FormError message={errors.location} />
                </div>
              </div>
            )}

            <div className="flex flex-col gap-3 border-t border-gray-100 pt-4">
              <h2 className="font-bold text-gray-900">Your Details</h2>
              {detailsFields}
            </div>

            <div className="border-t border-gray-100 pt-4">
              <PaymentBreakdown breakdown={breakdown} loading={loadingBreakdown} compact />
            </div>

            <button type="submit" disabled={submitting || !isOnline} className={buyButtonClass}>
              {submitting ? 'Processing...' : isOnline ? 'Buy' : 'Offline — payment unavailable'}
            </button>
          </motion.form>
        )}
      </AnimatePresence>
    </div>
  );
}
