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
  calculatePaymentBreakdown,
  formatCurrency,
  getPhonePlaceholder,
} from '../../utils/validation';
import { useToast } from '../../context/ToastContext';
import PackageSelector from './PackageSelector';
import PaymentBreakdown from './PaymentBreakdown';
import PackageImage from './PackageImage';
import { WAEC_IMAGE } from '../../constants/packageImages';
import { getNetworkBrandColors } from '../../constants/networkColors';
import { SUPPORT_EMAIL } from '../../constants/brand';
import FormError, { fieldClass } from '../ui/FormError';

function SelectedPackageSummary({ selected, brand }) {
  const label = selected.dataAmount || selected.name;
  return (
    <div className={`rounded-xl border p-4 ${brand.summaryBox}`}>
      <h2 className={`mb-3 text-sm font-bold tracking-tight ${brand.accent}`}>Your Package</h2>
      <p className="text-sm text-gray-800">
        Selected: <span className="font-bold text-gray-950">{label}</span>
      </p>
      <p className="mt-1 text-sm text-gray-800">
        Price: <span className={`font-bold ${brand.accent}`}>{formatCurrency(selected.price)}</span>
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
}) {
  const isChecker = Boolean(checkerExamOptions?.length);
  const brand = getNetworkBrandColors(isChecker ? 'WAEC Checkers' : category);
  const [step, setStep] = useState('select');
  const [selected, setSelected] = useState(null);
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
  const navigate = useNavigate();
  const { packages: afaPackages, isFetching: afaLoading } = usePackagesByCategory('MTN AFA');

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
    setBreakdown(calculatePaymentBreakdown(pkg.price));
    setStep('checkout');
  }, []);

  const handleGoBack = () => {
    setStep('select');
    setSelected(null);
    setBreakdown(null);
    setPromoApplied('');
    setErrors({});
    if (isChecker && onCheckerExamTypeChange) {
      onCheckerExamTypeChange(null);
    }
  };

  useEffect(() => {
    if (showPromoField) return;
    setPromoCode('');
    setPromoApplied('');
    if (selected) {
      setBreakdown(calculatePaymentBreakdown(selected.price));
    }
  }, [showPromoField, selected]);

  useEffect(() => {
    if (!showAfaForm || selected) return;

    const available = afaPackages.filter((p) => p.isActive !== false && p.isAvailable !== false);
    const registration =
      available.find((p) => p.afaType === 'new') ||
      available.find((p) => /registration/i.test(p.name)) ||
      available[0];

    if (registration) handleSelectPackage(registration);
  }, [showAfaForm, afaPackages, selected, handleSelectPackage]);

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
      toast(err.response?.data?.message || 'Invalid or expired promo code.', 'error');
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
    if (!validate()) {
      toast('Please complete all required fields correctly.', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const emailResult = validateEmail(email);
      const payload = {
        packageId: selected._id,
        phone: normalizePhone(phone),
        email: emailResult.normalized,
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
      toast(err.response?.data?.message || 'Failed to create order.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const isCheckout = step === 'checkout' && selected;

  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <div className="flex items-center gap-4">
        {isChecker ? (
          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-white p-2 shadow-lg ring-2 ring-blue-200 sm:h-24 sm:w-24">
            <img src={WAEC_IMAGE} alt="WAEC" className="h-full w-full object-contain" />
          </div>
        ) : (
          <PackageImage category={category} title={title} size="banner" />
        )}
        <div>
          <h1 className="section-title !text-2xl md:!text-3xl">{title}</h1>
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
            className="mt-4 rounded-xl border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-900"
          >
            Registration takes approximately 24 hours. Dial *1848# on the registered line to check your registration status.
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
            className="mt-8"
          >
            <div className="card">
              <h2 className="mb-4 font-bold text-gray-900">{isChecker ? 'Select Exam Type' : 'Select Package'}</h2>
              {isChecker && (
                <div className="mb-5 flex flex-wrap gap-3">
                  {checkerExamOptions.map(({ id, label }) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => onCheckerExamTypeChange(id)}
                      className={`pill-btn ${brand.pillHover} ${checkerExamType === id ? brand.pillActive : ''}`}
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
                  hideSummary={false}
                />
              )}
              {errors.package && <FormError message={errors.package} />}
            </div>
          </motion.div>
        )}

        {showAfaForm && afaLoading && !selected && (
          <p className="mt-8 text-sm text-gray-500">Loading AFA registration...</p>
        )}

        {showAfaForm && !afaLoading && !selected && (
          <motion.div key="afa-unavailable" className="card mt-8 text-sm text-red-600">
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
            className="mt-8 grid gap-8 lg:grid-cols-5"
          >
            <div className="space-y-6 lg:col-span-3">
              {!showAfaForm && (
                <button type="button" onClick={handleGoBack} className="btn-back">
                  {isChecker ? 'Change selection' : 'Change package'}
                </button>
              )}

              <SelectedPackageSummary selected={selected} brand={brand} />

              {showAfaForm && (
                <div className="card space-y-4">
                  <h2 className="font-bold">Registration Details</h2>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Full Name</label>
                    <input
                      className={fieldClass(errors.fullName)}
                      value={afaDetails.fullName}
                      onChange={(e) => {
                        setAfaDetails({ ...afaDetails, fullName: e.target.value });
                        clearError('fullName');
                      }}
                      placeholder="Your full name"
                      autoComplete="name"
                    />
                    <FormError message={errors.fullName} />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Ghana Card Number</label>
                    <input
                      className={fieldClass(errors.ghanaCard)}
                      value={afaDetails.ghanaCard}
                      onChange={(e) => {
                        setAfaDetails({ ...afaDetails, ghanaCard: e.target.value.toUpperCase() });
                        clearError('ghanaCard');
                      }}
                      placeholder="GHA-123456789-0"
                    />
                    <FormError message={errors.ghanaCard} />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Location</label>
                    <input
                      className={fieldClass(errors.location)}
                      value={afaDetails.location}
                      onChange={(e) => {
                        setAfaDetails({ ...afaDetails, location: e.target.value });
                        clearError('location');
                      }}
                      placeholder="Takoradi, Kumasi, Sunyani..."
                    />
                    <FormError message={errors.location} />
                  </div>
                </div>
              )}

              <div className="card space-y-4">
                <h2 className="font-bold">Your Details</h2>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Phone Number</label>
                  <p className="mb-2 text-xs font-medium text-gray-500">Enter recipient number</p>
                  <input
                    className={fieldClass(errors.phone)}
                    value={phone}
                    onChange={(e) => {
                      setPhone(normalizePhone(e.target.value).slice(0, 10));
                      clearError('phone');
                    }}
                    placeholder={getPhonePlaceholder(category)}
                    inputMode="numeric"
                    autoComplete="tel"
                  />
                  <FormError message={errors.phone} />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Email Address</label>
                  <input
                    className={fieldClass(errors.email)}
                    type="text"
                    inputMode="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      clearError('email');
                    }}
                    onBlur={() => {
                      if (!email.trim()) return;
                      const result = validateEmail(email);
                      if (!result.valid) {
                        setErrors((prev) => ({ ...prev, email: result.error }));
                      }
                    }}
                    placeholder={SUPPORT_EMAIL}
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
                        placeholder="PROMO123"
                      />
                      <button type="button" onClick={handleApplyPromo} className="btn-secondary shrink-0">
                        Apply
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="lg:col-span-2">
              <PaymentBreakdown breakdown={breakdown} loading={loadingBreakdown} />
              <button type="submit" disabled={submitting} className="btn-primary mt-4 w-full">
                {submitting ? 'Processing...' : 'Proceed to Payment'}
              </button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>
    </div>
  );
}
