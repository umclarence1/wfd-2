import mongoose from 'mongoose';

const PACKAGE_CATEGORIES = [
  'MTN',
  'Telecel',
  'AirtelTigo Big Time',
  'AirtelTigo',
  'MTN AFA',
  'BECE Checker',
  'WASSCE Checker',
];

const packageSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    category: { type: String, enum: PACKAGE_CATEGORIES, required: true },
    dataAmount: { type: String, trim: true },
    price: { type: Number, required: true, min: 0 },
    description: { type: String, default: '' },
    displayOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    isAvailable: { type: Boolean, default: true },
    serviceType: {
      type: String,
      enum: ['data_bundle', 'afa_registration', 'result_checker'],
      required: true,
    },
    afaType: { type: String, enum: ['new', 'renewal', 'status_check'], default: null },
    checkerType: { type: String, enum: ['BECE', 'WASSCE'], default: null },
  },
  { timestamps: true }
);

packageSchema.index({ category: 1, displayOrder: 1 });

export { PACKAGE_CATEGORIES };
export default mongoose.model('Package', packageSchema);
