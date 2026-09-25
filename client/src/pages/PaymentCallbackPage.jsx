import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import api from '../api/client';
import { CheckCircle, XCircle, Loader } from 'lucide-react';
import { formatCurrency } from '../utils/validation';
import { appendOrderToHistoryCookie } from '../utils/orderHistoryCookie';

export default function PaymentCallbackPage() {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState('loading');
  const [order, setOrder] = useState(null);
  const reference = searchParams.get('reference');

  useEffect(() => {
    if (!reference) { setStatus('error'); return; }

    const verifyUrl = `/orders/verify/${reference}`;

    const verifyWithRetry = async () => {
      const delays = [0, 3000, 5000, 7000, 10000, 12000, 15000, 15000, 15000];
      let lastError;
      for (const delay of delays) {
        if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
        try {
          return await api.get(verifyUrl, { timeout: 25000 });
        } catch (err) {
          lastError = err;
          const code = err.response?.status;
          if (code && code !== 400 && code !== 404 && code !== 409 && code !== 429 && code < 500) {
            throw err;
          }
        }
      }
      throw lastError;
    };

    verifyWithRetry()
      .then(({ data }) => {
        setOrder(data.order);
        appendOrderToHistoryCookie(data.order);
        setStatus('success');
      })
      .catch(() => setStatus('error'));
  }, [reference]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4 py-12">
      <div className="card w-full max-w-lg text-center">
        {status === 'loading' && (
          <>
            <Loader className="mx-auto h-12 w-12 animate-spin text-brand-600" />
            <p className="mt-4">Verifying payment...</p>
          </>
        )}
        {status === 'success' && (
          <>
            <CheckCircle className="mx-auto h-16 w-16 text-green-500" />
            <h1 className="mt-4 text-2xl font-bold">Payment Successful!</h1>
            {order && (
              <div className="mt-4 space-y-2 text-left text-sm">
                <p><strong>Reference:</strong> {order.reference}</p>
                <p><strong>Product:</strong> {order.packageName}</p>
                <p><strong>Amount:</strong> {formatCurrency(order.totalAmount)}</p>
                {(order.checkers?.length || order.checker) && (
                  <div className="mt-4 rounded-xl bg-green-50 p-4 transition-all duration-300 hover:shadow-md">
                    <p className="font-bold">Checker Details</p>
                    {(order.checkers?.length ? order.checkers : [order.checker]).map(
                      (checker, index) => (
                        <div
                          key={`${checker.serialNumber}-${index}`}
                          className={index ? 'mt-3 border-t border-green-200 pt-3' : 'mt-2'}
                        >
                          {(order.checkers?.length || 0) > 1 && (
                            <p className="font-semibold">Checker {index + 1}</p>
                          )}
                          <p>Serial: {checker.serialNumber}</p>
                          <p>PIN: {checker.pin}</p>
                        </div>
                      )
                    )}
                  </div>
                )}
              </div>
            )}
            <Link to="/order-history" className="btn-primary mt-6 inline-block">View Order History</Link>
          </>
        )}
        {status === 'error' && (
          <>
            <XCircle className="mx-auto h-16 w-16 text-red-500" />
            <h1 className="mt-4 text-2xl font-bold">Payment Not Completed</h1>
            <p className="mt-2 text-gray-600">
              If you already approved the payment on your phone, refresh this page. Paystack can take a minute to
              confirm it, and your order is saved as soon as that confirmation arrives.
            </p>
            <Link to="/services" className="btn-primary mt-6 inline-block">Back to Services</Link>
          </>
        )}
      </div>
    </div>
  );
}
