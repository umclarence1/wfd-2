import { useState } from 'react';
import api from '../api/client';
import { formatCurrency, formatDate, validateEmail } from '../utils/validation';
import { SUPPORT_EMAIL } from '../constants/brand';
import { useToast } from '../context/ToastContext';
import FormError, { fieldClass } from '../components/ui/FormError';

const statusColors = {
  pending: 'bg-amber-100 text-amber-800',
  processing: 'bg-blue-100 text-blue-800',
  delivered: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
  refunded: 'bg-gray-100 text-gray-800',
};

export default function OrderHistoryPage() {
  const [step, setStep] = useState('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const { toast } = useToast();

  const requestOTP = async (e) => {
    e.preventDefault();
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
      toast(err.response?.data?.message || 'Failed to send OTP.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const verifyOTP = async (e) => {
    e.preventDefault();
    const nextErrors = {};

    if (!otp.trim()) {
      nextErrors.otp = 'Enter the 6-digit code from your email.';
    } else if (otp.trim().length !== 6) {
      nextErrors.otp = 'The code must be 6 digits.';
    }

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      toast('Please enter your verification code.', 'error');
      return;
    }

    setLoading(true);
    try {
      const { data } = await api.post('/orders/history/verify', { email, otp });
      setOrders(data.orders);
      setStep('orders');
      setErrors({});
    } catch (err) {
      toast(err.response?.data?.message || 'Invalid OTP.', 'error');
    } finally {
      setLoading(false);
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
          <button type="submit" disabled={loading} className="btn-primary mt-4 w-full">
            {loading ? 'Sending...' : 'Send OTP'}
          </button>
        </form>
      )}

      {step === 'otp' && (
        <form noValidate onSubmit={verifyOTP} className="card mt-8 max-w-md">
          <p className="mb-4 text-sm font-medium text-gray-600">Enter the 6-digit code sent to {email}</p>
          <input
            className={`${fieldClass(errors.otp)} text-center text-2xl tracking-widest`}
            value={otp}
            onChange={(e) => {
              setOtp(e.target.value.replace(/\D/g, '').slice(0, 6));
              if (errors.otp) setErrors({});
            }}
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="000000"
            maxLength={6}
          />
          <FormError message={errors.otp} />
          <button type="submit" disabled={loading} className="btn-primary mt-4 w-full">
            {loading ? 'Verifying...' : 'Verify & View Orders'}
          </button>
        </form>
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
