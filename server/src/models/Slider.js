import mongoose from 'mongoose';

const sliderSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    imageUrl: { type: String, required: true },
    buttonText: { type: String, default: 'Get Started' },
    buttonUrl: { type: String, default: '/services' },
    displayOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.model('Slider', sliderSchema);
