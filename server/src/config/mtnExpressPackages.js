/** Default MTN EXPRESS bundle sizes and starter prices (editable in admin). */
export const MTN_EXPRESS_BUNDLES = [
  '1GB',
  '2GB',
  '3GB',
  '4GB',
  '5GB',
  '6GB',
  '8GB',
  '10GB',
  '15GB',
  '20GB',
  '25GB',
  '30GB',
  '40GB',
  '50GB',
  '100GB',
];

export const MTN_EXPRESS_DEFAULT_PRICES = {
  '1GB': 4.8,
  '2GB': 9,
  '3GB': 14.5,
  '4GB': 18.8,
  '5GB': 23.7,
  '6GB': 27,
  '8GB': 35.5,
  '10GB': 42.5,
  '15GB': 62,
  '20GB': 81,
  '25GB': 101.5,
  '30GB': 120,
  '40GB': 159,
  '50GB': 198,
  '100GB': 380,
};

export const buildMtnExpressPackages = () =>
  MTN_EXPRESS_BUNDLES.map((size, i) => ({
    name: `MTN EXPRESS ${size}`,
    category: 'MTN EXPRESS',
    dataAmount: size,
    price: MTN_EXPRESS_DEFAULT_PRICES[size],
    serviceType: 'data_bundle',
    displayOrder: i,
    isActive: true,
    isAvailable: true,
    adminPaused: false,
  }));
