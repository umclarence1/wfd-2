import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import api from '../api/client';
import { CheckCircle, XCircle, Loader } from 'lucide-react';
import { formatCurrency } from '../utils/validation';

export default function PaymentCallbackPage() {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState('loading');
  const [order, setOrder] = useState(null);
  const reference = searchParams.get('reference');
  const isFree = searchParams.get('free');

  useEffect(() => {
    if (isFree && reference) {
      api.get(`/orders/${reference}`).then(({ data }) => {
        setOrder(data.order);
        setStatus('success');
      }).catch(() => setStatus('error'));
      return;
    }

    if (!reference) { setStatus('error'); return; }

    api.get(`/orders/verify/${reference}`)
      .then(({ data }) => {
        setOrder(data.order);
        setStatus('success');
      })
      .catch(() => setStatus('error'));
  }, [reference, isFree]);

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
                <p><strong>Status:</strong> {order.deliveryStatus}</p>
                {order.checker && (
                  <div className="mt-4 rounded-xl bg-green-50 p-4 transition-all duration-300 hover:shadow-md">
                    <p className="font-bold">Checker Details</p>
                    <p>Serial: {order.checker.serialNumber}</p>
                    <p>PIN: {order.checker.pin}</p>
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
            <h1 className="mt-4 text-2xl font-bold">Payment Failed</h1>
            <p className="mt-2 text-gray-600">Something went wrong. Please try again or contact support.</p>
            <Link to="/services" className="btn-primary mt-6 inline-block">Back to Services</Link>
          </>
        )}
      </div>
    </div>
  );
}
