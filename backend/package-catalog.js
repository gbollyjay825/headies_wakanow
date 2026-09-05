const INCLUSIONS = ['Flight', 'Hotel', 'Transfers', 'Travel insurance', 'Headies access'];
const PACKAGES = [
  {
    slug: 'value', name: '3-Star Value Package', tier: 'value', stars: 3, priceNaira: 4044000,
    tagline: 'Your Headies experience starts here.',
    description: 'Enjoy Toronto and the Headies with a practical stay and the essential travel inclusions in one package.',
    hotels: ['Holiday Inn', 'Courtyard by Marriott', 'Chelsea Hotel']
  },
  {
    slug: 'premium', name: '4-Star Premium Package', tier: 'premium', stars: 4, priceNaira: 3398000,
    tagline: 'Stay in comfort. Arrive in style.',
    description: 'Make more of your Toronto trip with a four-star hotel stay, travel essentials and access to the Headies.',
    hotels: ['Pantages Hotel', 'DoubleTree by Hilton', 'Delta Hotels']
  },
  {
    slug: 'vip', name: '5-Star VIP Package', tier: 'vip', stars: 5, priceNaira: 7077000,
    tagline: 'A five-star setting for an unforgettable night.',
    description: 'Discover a premium Toronto experience with five-star hotel options and the travel inclusions for your Headies trip.',
    hotels: ['1 Hotel Toronto', 'Park Hyatt Toronto', 'The Ritz-Carlton']
  }
];

function configuration(slug, key) {
  return String(process.env[`PACKAGE_${slug.toUpperCase()}_${key}`] || process.env[`PACKAGE_${key}`] || '').trim();
}

function listPackages() {
  return PACKAGES.map((item) => {
    const travelDates = configuration(item.slug, 'TRAVEL_DATES');
    const departureCity = configuration(item.slug, 'DEPARTURE_CITY');
    const configuredNights = Number(configuration(item.slug, 'NIGHTS'));
    const nights = Number.isInteger(configuredNights) && configuredNights > 0 && configuredNights <= 90 ? configuredNights : null;
    const terms = configuration(item.slug, 'TERMS');
    const priceOverride = configuration(item.slug, 'PRICE_NAIRA');
    const configuredPrice = Number(priceOverride);
    const validPriceOverride = Number.isSafeInteger(configuredPrice) && configuredPrice > 0 && Number.isSafeInteger(configuredPrice * 600);
    const priceNaira = validPriceOverride ? configuredPrice : item.priceNaira;
    const checkoutEnabled = configuration(item.slug, 'CHECKOUT_ENABLED') !== 'false' && (!priceOverride || validPriceOverride);
    return {
      ...item, priceNaira, currency: 'NGN', priceBasis: 'per person',
      image: `/assets/packages/${item.slug}-flyer.jpg`,
      inclusions: [...INCLUSIONS],
      exclusions: ['Visa arrangements, personal expenses and any additional costs are not specified in the flyer. Please discuss these with the travel team.'],
      travelDates, departureCity, nights, terms, checkoutEnabled,
      unavailableReason: checkoutEnabled ? '' : 'Booking is temporarily unavailable. Please try again shortly.'
    };
  });
}

function getPackage(slug) {
  return listPackages().find((item) => item.slug === slug) || null;
}

module.exports = { listPackages, getPackage };
