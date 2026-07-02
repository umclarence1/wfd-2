import mongoose from 'mongoose';

const promoRedemptionSchema = new mongoose.Schema(
  {
    reference: { type: String, required: true, unique: true },
    promoCode: { type: mongoose.Schema.Types.ObjectId, ref: 'PromoCode', required: true },
    code: { type: String, required: true },
    email: { type: String, required: true, lowercase: true },
    phone: { type: String, required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', default: null },
  },
  { timestamps: true }
);

promoRedemptionSchema.index({ promoCode: 1, email: 1 });
promoRedemptionSchema.index({ promoCode: 1, phone: 1 });
promoRedemptionSchema.index({ promoCode: 1, user: 1 });
promoRedemptionSchema.index({ order: 1 }, { unique: true, sparse: true });

export default mongoose.model('PromoRedemption', promoRedemptionSchema);
