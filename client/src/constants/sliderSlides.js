export const SLIDE_IMAGE_POSITIONS = {
  '/images/slider/slide-1.jpg': 'center bottom',
  '/images/slider/slide-2.jpg': 'center 22%',
  '/images/slider/slide-3.jpg': 'center top',
  '/images/slider/slide-4.jpg': 'center center',
};

export const getSlideImagePosition = (slide) =>
  slide?.imagePosition || SLIDE_IMAGE_POSITIONS[slide?.imageUrl] || 'center top';

export const DEFAULT_SLIDER_SLIDES = [
  {
    _id: 'default-1',
    title: 'MTN Data Bundles',
    description: 'Get instant MTN, Telecel & AirtelTigo data bundles at unbeatable prices.',
    imageUrl: '/images/slider/slide-1.jpg',
    imagePosition: 'center bottom',
    buttonText: 'Buy Data Now',
    buttonUrl: '/services/data/mtn',
    displayOrder: 0,
    isActive: true,
  },
  {
    _id: 'default-2',
    title: 'Fast. Easy. Delivered.',
    description: 'Purchase data bundles online and receive them within seconds — no hassle.',
    imageUrl: '/images/slider/slide-2.jpg',
    imagePosition: 'center 22%',
    buttonText: 'Browse Services',
    buttonUrl: '/services',
    displayOrder: 1,
    isActive: true,
  },
  {
    _id: 'default-3',
    title: 'Stay Connected Always',
    description: 'Top up your phone with affordable bundles from Ghana\'s leading networks.',
    imageUrl: '/images/slider/slide-3.jpg',
    imagePosition: 'center top',
    buttonText: 'Get Started',
    buttonUrl: '/services/data/mtn',
    displayOrder: 2,
    isActive: true,
  },
  {
    _id: 'default-4',
    title: 'BECE & WASSCE Result Checkers',
    description: 'Students — get authentic result checkers delivered instantly via email and SMS.',
    imageUrl: '/images/slider/slide-4.jpg',
    imagePosition: 'center center',
    buttonText: 'Get Checker',
    buttonUrl: '/services/checkers',
    displayOrder: 3,
    isActive: true,
  },
];
