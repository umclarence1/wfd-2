import mongoose from 'mongoose';

/** One row per Paystack reference so a retried webhook cannot fulfill twice. */
const processedWebhookSchema = new mongoose.Schema(
  {
    reference: { type: String, required: true, unique: true },
    event: { type: String, required: true },
    status: { type: String, default: 'processing' },
  },
  { timestamps: true }
);

export default mongoose.model('ProcessedWebhook', processedWebhookSchema);
