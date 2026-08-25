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
  '1GB': 5,
  '2GB': 9.5,
  '3GB': 14.8,
  '4GB': 18.8,
  '5GB': 23.5,
  '6GB': 27.6,
  '8GB': 37,
  '10GB': 44.5,
  '15GB': 63,
  '20GB': 84.5,
  '25GB': 103,
  '30GB': 123,
  '40GB': 162,
  '50GB': 210,
  '100GB': 412,
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
