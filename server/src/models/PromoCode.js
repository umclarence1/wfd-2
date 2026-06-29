import mongoose from 'mongoose';

const promoCodeSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    description: { type: String, default: '' },
    discountType: {
      type: String,
      enum: ['free', 'percentage', 'fixed'],
      default: 'free',
    },
    discountValue: { type: Number, default: 100 },
    productCategories: [{ type: String }],
    productIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Package' }],
    expiryDate: { type: Date, required: true },
    usageLimit: { type: Number, default: null },
    usageCount: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    onePerEmail: { type: Boolean, default: true },
    onePerPhone: { type: Boolean, default: true },
    onePerAccount: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.model('PromoCode', promoCodeSchema);
