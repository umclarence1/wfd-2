import mongoose from 'mongoose';

const checkerSchema = new mongoose.Schema(
  {
    checkerType: { type: String, enum: ['BECE', 'WASSCE'], required: true },
    serialNumber: { type: String, required: true, unique: true, trim: true },
    pin: { type: String, required: true, trim: true },
    year: { type: String, required: true, trim: true },
    status: { type: String, enum: ['used', 'unused'], default: 'unused' },
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', default: null },
    usedAt: Date,
  },
  { timestamps: true }
);

checkerSchema.index({ checkerType: 1, status: 1 });

export default mongoose.model('Checker', checkerSchema);
