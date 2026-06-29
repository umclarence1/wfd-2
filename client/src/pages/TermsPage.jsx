export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 prose dark:prose-invert">
      <h1 className="section-title">Terms & Conditions</h1>
      <div className="mt-8 space-y-4 text-gray-600 dark:text-gray-400">
        <p>By using Wilberforce Data Service, you agree to these terms.</p>
        <h2 className="text-lg font-bold text-gray-900 dark:text-white">Services</h2>
        <p>We provide data bundles, MTN AFA registration, and result checker services. Delivery times may vary by service type.</p>
        <h2 className="text-lg font-bold text-gray-900 dark:text-white">Payments</h2>
        <p>All payments are processed securely through Paystack. A 2% processing fee applies at checkout.</p>
        <h2 className="text-lg font-bold text-gray-900 dark:text-white">Refunds</h2>
        <p>Refunds are processed for failed deliveries. Contact support with your order reference.</p>
      </div>
    </div>
  );
}
