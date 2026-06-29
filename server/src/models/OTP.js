import mongoose from 'mongoose';

const otpSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, lowercase: true },
    otp: { type: String, required: true },
    purpose: {
      type: String,
      enum: ['order_history', 'email_verification', 'admin_login'],
      default: 'order_history',
    },
    expiresAt: { type: Date, required: true },
    attempts: { type: Number, default: 0 },
    isUsed: { type: Boolean, default: false },
  },
  { timestamps: true }
);

otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model('OTP', otpSchema);
