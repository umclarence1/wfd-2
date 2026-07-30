import { useRef, useState } from 'react';
import api from '../api/client';
import { formatCurrency, formatDate, validateEmail } from '../utils/validation';
import { SUPPORT_EMAIL } from '../constants/brand';
import { useToast } from '../context/ToastContext';
import { useOnlineStatus } from '../context/OnlineContext';
import { getOfflineAwareErrorMessage, OFFLINE_ACTION_MESSAGE } from '../utils/offline';
import FormError, { fieldClass } from '../components/ui/FormError';
import OtpInput from '../components/ui/OtpInput';
import { Loader2 } from 'lucide-react';

const statusColors = {
  pending: 'bg-amber-100 text-amber-800',
  processing: 'bg-blue-100 text-blue-800',
  verification: 'bg-violet-100 text-violet-800',
  delivered: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
  refunded: 'bg-gray-100 text-gray-800',
  cancelled: 'bg-slate-200 text-slate-700',
};

export default function OrderHistoryPage() {
  const verifyLock = useRef(false);
  const [step, setStep] = useState('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const { toast } = useToast();
  const { isOnline } = useOnlineStatus();

  const requestOTP = async (e) => {
    e.preventDefault();
    if (!isOnline) {
      toast(OFFLINE_ACTION_MESSAGE, 'error');
      return;
    }
    const emailResult = validateEmail(email);

    if (!emailResult.valid) {
      setErrors({ email: emailResult.error });
      toast(emailResult.error, 'error');
      return;
    }

    setLoading(true);
    try {
      await api.post('/orders/history/request-otp', { email: emailResult.normalized });
      toast('OTP sent to your email.', 'success');
      setStep('otp');
      setErrors({});
    } catch (err) {
      toast(getOfflineAwareErrorMessage(err, 'Failed to send OTP.'), 'error');
    } finally {
      setLoading(false);
    }
  };

  const submitOtp = async (code) => {
    if (verifyLock.current || loading) return;
    if (!isOnline) {
      toast(OFFLINE_ACTION_MESSAGE, 'error');
      return;
    }

    verifyLock.current = true;
    setLoading(true);
    setErrors({});

    try {
      const { data } = await api.post('/orders/history/verify', { email, otp: code });
      setOrders(data.orders);
      setStep('orders');
    } catch (err) {
      setOtp('');
      setErrors({ otp: getOfflineAwareErrorMessage(err, 'Invalid OTP.') });
      toast(getOfflineAwareErrorMessage(err, 'Invalid OTP.'), 'error');
    } finally {
      setLoading(false);
      verifyLock.current = false;
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="section-title">Order History</h1>
      <p className="section-subtitle">Check your orders without logging in</p>

      {step === 'email' && (
        <form noValidate onSubmit={requestOTP} className="card mt-8 max-w-md">
          <label className="mb-1 block text-sm font-medium text-gray-700">Email Address</label>
          <input
            className={fieldClass(errors.email)}
            type="text"
            inputMode="email"
            autoComplete="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (errors.email) setErrors({});
            }}
            onBlur={() => {
              if (!email.trim()) return;
              const result = validateEmail(email);
              if (!result.valid) setErrors({ email: result.error });
            }}
            placeholder={SUPPORT_EMAIL}
          />
          <FormError message={errors.email} />
          <button type="submit" disabled={loading || !isOnline} className="btn-primary mt-4 w-full">
            {loading ? 'Sending...' : isOnline ? 'Send OTP' : 'Offline — login unavailable'}
          </button>
        </form>
      )}

      {step === 'otp' && (
        <div className="card mt-8 max-w-md">
          <p className="mb-5 text-center text-sm font-medium text-gray-600">
            Enter the 6-digit code sent to {email}
          </p>
          <OtpInput
            value={otp}
            onChange={(code) => {
              setOtp(code);
              if (errors.otp) setErrors({});
            }}
            onComplete={submitOtp}
            disabled={loading || !isOnline}
            error={Boolean(errors.otp)}
            autoFocus
          />
          <FormError message={errors.otp} />
          {loading && (
            <div className="mt-4 flex items-center justify-center gap-2 text-sm font-medium text-blue-700">
              <Loader2 className="h-4 w-4 animate-spin" />
              Verifying...
            </div>
          )}
        </div>
      )}

      {step === 'orders' && (
        <div className="mt-8 space-y-4">
          {orders.length === 0 ? (
            <p className="font-medium text-gray-600">No orders found for this email.</p>
          ) : (
            orders.map((order) => (
              <div key={order.reference} className="card-hover">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-bold">{order.packageName}</p>
                    <p className="text-sm text-gray-500">{order.reference}</p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold transition-transform duration-200 hover:scale-105 ${statusColors[order.deliveryStatus]}`}>
                    {order.deliveryStatus}
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  <div><span className="text-gray-500">Phone:</span> {order.phone}</div>
                  <div><span className="text-gray-500">Amount:</span> {formatCurrency(order.totalAmount)}</div>
                  <div><span className="text-gray-500">Payment:</span> {order.paymentStatus}</div>
                  <div><span className="text-gray-500">Date:</span> {formatDate(order.createdAt)}</div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
