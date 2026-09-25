import mongoose from 'mongoose';

const orderSchema = new mongoose.Schema(
  {
    reference: { type: String, required: true, unique: true },
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
    isFreeOrder: { type: Boolean, default: false },
    paymentStatus: {
      type: String,
      enum: ['pending', 'paid', 'failed', 'refunded'],
      default: 'pending',
    },
    deliveryStatus: {
      type: String,
      enum: ['pending', 'processing', 'verification', 'delivered', 'failed', 'refunded', 'cancelled'],
      default: 'pending',
    },
    paymentReference: { type: String, unique: true, sparse: true },
    idempotencyKey: { type: String, unique: true, sparse: true },
    paystackTransactionId: String,
    providerReference: String,
    providerId: String,
    providerResponse: mongoose.Schema.Types.Mixed,
    checker: { type: mongoose.Schema.Types.ObjectId, ref: 'Checker', default: null },
    checkers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Checker' }],
    afaDetails: {
      fullName: String,
      ghanaCard: String,
      location: String,
      afaType: String,
    },
    metadata: mongoose.Schema.Types.Mixed,
    failureReason: String,
    retryCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

orderSchema.index({ email: 1, createdAt: -1 });
orderSchema.index({ phone: 1 });
orderSchema.index({ deliveryStatus: 1 });
orderSchema.index({ paymentStatus: 1 });
orderSchema.index({
  paymentStatus: 1,
  deliveryStatus: 1,
  'metadata.queuedForProvider': 1,
  'metadata.submittedToProvider': 1,
});
orderSchema.index({ 'metadata.topdealsOrderId': 1 }, { sparse: true });
orderSchema.index({ 'metadata.purchaseGuardKey': 1 }, { unique: true, sparse: true });

export default mongoose.model('Order', orderSchema);
