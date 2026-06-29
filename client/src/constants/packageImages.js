export const WAEC_IMAGE = '/images/networks/waec.jpg';

export const PACKAGE_IMAGES = {
  MTN: '/images/networks/mtn.jpg',
  Telecel: '/images/networks/telecel.jpg',
  AirtelTigo: '/images/networks/airteltigo.jpg',
  'MTN AFA': '/images/networks/afa.jpg',
  'WAEC Checkers': WAEC_IMAGE,
  'BECE Checker': WAEC_IMAGE,
  'WASSCE Checker': WAEC_IMAGE,
};

export const SERVICE_CATEGORIES = [
  {
    id: 'mtn',
    title: 'MTN Data Bundles',
    category: 'MTN',
    link: '/services/data/mtn',
    image: PACKAGE_IMAGES.MTN,
    accent: 'ring-yellow-400/30 hover:ring-yellow-400/60',
  },
  {
    id: 'telecel',
    title: 'Telecel Data Bundles',
    category: 'Telecel',
    link: '/services/data/telecel',
    image: PACKAGE_IMAGES.Telecel,
    accent: 'ring-red-400/30 hover:ring-red-400/60',
  },
  {
    id: 'airteltigo',
    title: 'AirtelTigo Regular',
    category: 'AirtelTigo',
    link: '/services/data/airteltigo',
    image: PACKAGE_IMAGES.AirtelTigo,
    accent: 'ring-red-500/30 hover:ring-red-500/60',
  },
  {
    id: 'afa',
    title: 'MTN AFA Registration',
    category: 'MTN AFA',
    link: '/services/afa',
    image: PACKAGE_IMAGES['MTN AFA'],
    accent: 'ring-yellow-400/30 hover:ring-yellow-400/60',
  },
  {
    id: 'waec',
    title: 'Result Checker',
    category: 'WAEC Checkers',
    link: '/services/checkers',
    image: PACKAGE_IMAGES['WAEC Checkers'],
    accent: 'ring-violet-400/30 hover:ring-violet-400/60',
  },
  {
    id: 'web-dev',
    title: 'Web Development',
    link: '/services/web-development',
    image: null,
    accent: 'ring-blue-400/30 hover:ring-blue-400/60',
  },
];

export const getPackageImage = (category) => PACKAGE_IMAGES[category] || null;
