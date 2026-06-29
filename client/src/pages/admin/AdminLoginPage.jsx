import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { Shield } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { SITE_NAME } from '../../constants/brand';
import FormError, { fieldClass } from '../../components/ui/FormError';

export default function AdminLoginPage() {
  const { adminLogin, isAdmin, loading } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [email, setEmail] = useState('admin@wds.com');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});

  if (!loading && isAdmin) {
    return <Navigate to="/admin/dashboard" replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    const nextErrors = {};
    if (!email.trim()) nextErrors.email = 'Email is required.';
    if (!password) nextErrors.password = 'Password is required.';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    setSubmitting(true);
    try {
      await adminLogin(email.trim(), password);
      toast('Welcome back!', 'success');
      navigate('/admin/dashboard');
    } catch (err) {
      toast(err.response?.data?.message || 'Login failed.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="admin-login-bg flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-600/30">
            <Shield className="h-7 w-7" />
          </span>
          <h1 className="mt-5 text-2xl font-bold text-white">{SITE_NAME}</h1>
          <p className="mt-2 text-sm text-blue-100">Sign in to your admin dashboard</p>
        </div>

        <div className="admin-panel !shadow-2xl">
          <form noValidate onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">Email</label>
              <input
                className={fieldClass(errors.email)}
                type="text"
                inputMode="email"
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
            <button type="submit" disabled={submitting} className="btn-primary w-full !py-3">
              {submitting ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-500">
            <Link to="/" className="font-semibold text-blue-700 hover:underline">
              ← Back to website
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
