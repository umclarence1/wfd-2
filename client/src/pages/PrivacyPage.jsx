export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="section-title">Privacy Policy</h1>
      <div className="mt-8 space-y-4 text-gray-600 dark:text-gray-400">
        <p>Wilberforce Data Service respects your privacy and protects your personal information.</p>
        <h2 className="text-lg font-bold text-gray-900 dark:text-white">Information We Collect</h2>
        <p>We collect email, phone number, and payment information necessary to process your orders.</p>
        <h2 className="text-lg font-bold text-gray-900 dark:text-white">How We Use Your Data</h2>
        <p>Your data is used for order processing, delivery notifications, and customer support only.</p>
        <h2 className="text-lg font-bold text-gray-900 dark:text-white">Security</h2>
        <p>We use industry-standard encryption, secure cookies, and JWT authentication to protect your data.</p>
      </div>
    </div>
  );
}
