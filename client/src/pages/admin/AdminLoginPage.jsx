import { useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useOnlineStatus } from '../../context/OnlineContext';
import { getOfflineAwareErrorMessage, OFFLINE_ACTION_MESSAGE } from '../../utils/offline';
import { SITE_NAME, SUPPORT_EMAIL } from '../../constants/brand';
import FormError, { fieldClass } from '../../components/ui/FormError';
import OtpInput from '../../components/ui/OtpInput';
import OfflineBanner from '../../components/pwa/OfflineBanner';

export default function AdminLoginPage() {
  const { adminLogin, adminVerifyOtp, adminResendOtp, isAdmin, loading } = useAuth();
  const { toast } = useToast();
  const { isOnline } = useOnlineStatus();
  const navigate = useNavigate();
  const verifyLock = useRef(false);
  const [step, setStep] = useState('credentials');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [pendingToken, setPendingToken] = useState('');
  const [otpSentTo, setOtpSentTo] = useState('');
  const [deliveryMethod, setDeliveryMethod] = useState('email');
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});

  if (!loading && isAdmin) {
    return <Navigate to="/admin/dashboard" replace />;
  }

  const handleCredentialsSubmit = async (e) => {
    e.preventDefault();
    if (!isOnline) {
      toast(OFFLINE_ACTION_MESSAGE, 'error');
      return;
    }
    const nextErrors = {};
    if (!email.trim()) nextErrors.email = 'Email is required.';
    if (!password) nextErrors.password = 'Password is required.';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    setSubmitting(true);
    try {
      const data = await adminLogin(email.trim(), password);
      setPendingToken(data.pendingToken);
      setOtpSentTo(data.otpSentTo || SUPPORT_EMAIL);
      setDeliveryMethod(data.deliveryMethod || 'email');
      setStep('otp');
      toast(data.message || 'Verification code sent.', 'success');
    } catch (err) {
      toast(getOfflineAwareErrorMessage(err, 'Login failed.'), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const submitOtp = async (code) => {
    if (!pendingToken || verifyLock.current || submitting) return;
    if (!isOnline) {
      toast(OFFLINE_ACTION_MESSAGE, 'error');
      return;
    }

    verifyLock.current = true;
    setSubmitting(true);
    setErrors({});

    try {
      await adminVerifyOtp(pendingToken, code);
      toast('Welcome back!', 'success');
      navigate('/admin/dashboard');
    } catch (err) {
      setOtp('');
      setErrors({ otp: getOfflineAwareErrorMessage(err, 'Invalid verification code.') });
      toast(getOfflineAwareErrorMessage(err, 'Invalid verification code.'), 'error');
    } finally {
      setSubmitting(false);
      verifyLock.current = false;
    }
  };

  const handleResendOtp = async () => {
    if (!pendingToken || submitting) return;
    if (!isOnline) {
      toast(OFFLINE_ACTION_MESSAGE, 'error');
      return;
    }
    setSubmitting(true);
    try {
      const data = await adminResendOtp(pendingToken);
      setOtp('');
      setErrors({});
      toast(data.message || 'A new code was sent.', 'success');
    } catch (err) {
      toast(getOfflineAwareErrorMessage(err, 'Could not resend code.'), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="admin-login-bg flex min-h-screen flex-col">
      <OfflineBanner />
      <div className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-white">{SITE_NAME}</h1>
          <p className="mt-2 text-sm text-blue-100">
            {step === 'otp' ? 'Enter your verification code' : 'Sign in to your admin dashboard'}
          </p>
        </div>

        <div className="admin-panel !shadow-2xl">
          {step === 'credentials' ? (
            <form noValidate onSubmit={handleCredentialsSubmit} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">Email</label>
                <input
                  className={fieldClass(errors.email)}
                  type="text"
                  autoComplete="username"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (errors.email) setErrors({});
                  }}
                />
                <FormError message={errors.email} />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">Password</label>
                <input
                  className={fieldClass(errors.password)}
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (errors.password) setErrors({});
                  }}
                />
                <FormError message={errors.password} />
              </div>
              <button type="submit" disabled={submitting || !isOnline} className="btn-primary w-full !py-3">
                {submitting ? 'Signing in...' : isOnline ? 'Continue' : 'Offline — login unavailable'}
              </button>
            </form>
          ) : (
            <div className="space-y-5">
              <p className="text-center text-sm text-slate-600">
                {deliveryMethod === 'sms'
                  ? `Enter the 6-digit code sent by SMS to ${otpSentTo}`
                  : `Enter the 6-digit code sent to ${otpSentTo}`}
              </p>

              <OtpInput
                value={otp}
                onChange={(code) => {
                  setOtp(code);
                  if (errors.otp) setErrors({});
                }}
                onComplete={submitOtp}
                disabled={submitting || !isOnline}
                error={Boolean(errors.otp)}
                autoFocus
              />

              <FormError message={errors.otp} />

              {submitting && (
                <div className="flex items-center justify-center gap-2 text-sm font-medium text-blue-700">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Verifying...
                </div>
              )}

              <div className="text-center text-sm">
                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={submitting || !isOnline}
                  className="font-semibold text-blue-700 hover:underline disabled:opacity-50"
                >
                  Resend code
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      </div>
    </div>
  );
}
