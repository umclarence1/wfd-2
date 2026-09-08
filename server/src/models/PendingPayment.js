import mongoose from 'mongoose';

/** Checkout intent — converted to Order only after Paystack confirms payment. */
const pendingPaymentSchema = new mongoose.Schema(
  {
    paymentReference: { type: String, required: true, unique: true },
    idempotencyKey: { type: String, unique: true, sparse: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    email: { type: String, required: true, lowercase: true },
    phone: { type: String, required: true },
    package: { type: mongoose.Schema.Types.ObjectId, ref: 'Package', required: true },
    packageName: { type: String, required: true },
    category: { type: String, required: true },
    serviceType: { type: String, required: true },
    packagePrice: { type: Number, required: true },
    quantity: { type: Number, default: 1, min: 1, max: 5 },
    paystackCharge: { type: Number, default: 0 },
    totalAmount: { type: Number, required: true },
    promoCode: { type: String, default: null },
    promoDiscount: { type: Number, default: 0 },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

pendingPaymentSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model('PendingPayment', pendingPaymentSchema);
