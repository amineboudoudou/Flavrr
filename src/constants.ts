
import { MenuItem, Category, ThemeConfig, StorefrontReview, NewsPost, Language, LocalizedString, OrganizationProfile } from './types';

export const THEME: ThemeConfig = {
  primary: '#FF1493',
  accent: '#FF69B4',
  text: '#FFFFFF',
  glass: 'rgba(255, 255, 255, 0.1)',
  cardBg: 'rgba(255, 20, 147, 0.05)'
};

export const UI_STRINGS: Record<string, Record<Language, string>> = {
  chefChoice: { fr: "Le choix du Chef", en: "Chef's Choice" },
  priceLabel: { fr: "Prix du plat", en: "Plate Price" },
  addBtn: { fr: "Let's go 😋", en: "Add to Cart 😋" },
  swipeHint: { fr: "Swipe pour savourer", en: "Swipe to savor" },
  catHeader: { fr: "Le menu, par catégorie", en: "Menu by category" },
  catSub: { fr: "Choisis ta vibe, on s’occupe du reste 😋", en: "Choose your vibe, we handle the rest 😋" },
  catTap: { fr: "Tap une carte pour voir les plats", en: "Tap a card to see dishes" },
  exploreSelection: { fr: "Explore la sélection", en: "Explore the selection" },
  tapToFull: { fr: "Tap un plat pour le voir en plein écran", en: "Tap a dish to view full screen" },
  cartTitle: { fr: "Ta Sélection 🧺", en: "Your Selection 🧺" },
  cartEmpty: { fr: "Ton panier est vide... pour l'instant 👀", en: "Your cart is empty... for now 👀" },
  cartTotal: { fr: "Total", en: "Total" },
  cartCheckout: { fr: "Passer la commande", en: "Checkout" },
  floatingCartCta: { fr: "Voir mon panier", en: "View cart" },
  floatingCartSubtitle: { fr: "Ta sélection t'attend", en: "Your feast is waiting" },
  bookingTitle: { fr: "Réserver une table", en: "Book a table" },
  bookingSub: { fr: "Viens vivre l'expérience Café Du Griot sur place", en: "Come experience Café Du Griot in person" },
  bookingTime: { fr: "Choisir l'heure", en: "Pick a time" },
  bookingGuests: { fr: "Nombre de personnes", en: "Number of guests" },
  bookingConfirm: { fr: "Confirmer la réservation", en: "Confirm booking" },
  newsTitle: { fr: "Événements & Nouvelles", en: "Events & News" },
  newsJournal: { fr: "Le Journal du Griot", en: "The Griot Journal" },
  newsReadMore: { fr: "Lire la suite", en: "Read more" },
  deliveryTitle: { fr: "Le Voyage Culinaire", en: "The Culinary Journey" },
  deliverySub: { fr: "Le goût authentique d'Haïti, livré partout à Montréal.", en: "Authentic taste of Haiti, delivered across Montreal." },
  reviewTitle: { fr: "Vos Avis Gourmands", en: "Your Gourmet Reviews" },
  reviewSub: { fr: "Des milliers de Montréalais ont déjà succombé au Griot.", en: "Thousands of Montrealers have already fallen for the Griot." },
  fulfillmentDelivery: { fr: "Livraison", en: "Delivery" },
  fulfillmentPickup: { fr: "Ramassage", en: "Pickup" },
  pickupAddress: { fr: "Adresse de ramassage", en: "Pickup Address" },
  chooseTime: { fr: "Choisir l'heure", en: "Choose your time" },
  closedMessage: { fr: "Nous sommes actuellement fermés ou aucune plage disponible pour aujourd'hui.", en: "We are currently closed or no slots available for today." },
  specialInstructions: { fr: "Instructions spéciales", en: "Special Instructions" },
  instructionsPlaceholder: { fr: "Code de porte, instructions...", en: "Door code, special notes..." },
  paymentTitle: { fr: "Paiement", en: "Payment" },
  confirmTitle: { fr: "Confirmé", en: "Confirmed" },
  stepOf: { fr: "Étape", en: "Step" },
  reviewItems: { fr: "Récapitulatif", en: "Review Items" },
  customerDetails: { fr: "Coordonnées", en: "Customer Details" },
  orderReceived: { fr: "Commande Reçue !", en: "Order Received!" },
  orderThanks: { fr: "Merci {name}, votre festin est en route.", en: "Thanks {name}, your feast is on the way." },
  orderNumber: { fr: "Numéro de Commande", en: "Order Number" },
  backToMenu: { fr: "Retour au Menu", en: "Back to Menu" },
  payNow: { fr: "Payer Maintenant", en: "Pay Now" },
  orderTotal: { fr: "Total de la commande", en: "Order total" },
  taxesIncluded: { fr: "Taxes & Livraison incl.", en: "Taxes & Delivery incl." }
};

export const CATEGORIES: Category[] = [
  {
    id: 'cat-signature',
    label: { fr: 'Signatures du Chef', en: "Chef's Signatures" },
    image: 'https://images.unsplash.com/photo-1473093226795-af9932fe5856?auto=format&fit=crop&w=800&q=80',
    vibe: {
      fr: 'Le meilleur du griot, des parfums caribéens et des assiettes audacieuses.',
      en: 'Griot classics and bold Caribbean plates.'
    }
  },
  {
    id: 'cat-brunch',
    label: { fr: 'Brunch Soleil', en: 'Sunrise Brunch' },
    image: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=800&q=80',
    vibe: {
      fr: 'Un brunch tropical aux accents haïtiens.',
      en: 'A tropical brunch with Haitian flair.'
    }
  },
  {
    id: 'cat-liquid',
    label: { fr: 'Cocktails & Rituels', en: 'Cocktails & Rituals' },
    image: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=800&q=80',
    vibe: {
      fr: 'Mixologie, infusions et vibrations nocturnes.',
      en: 'Mixology, infusions, late-night vibes.'
    }
  }
];

export const CATEGORY_METADATA: Record<string, { image: string; vibe: Record<Language, string> }> = {
  'cat-signature': {
    image: CATEGORIES[0].image!,
    vibe: CATEGORIES[0].vibe || { fr: '', en: '' }
  },
  'cat-brunch': {
    image: CATEGORIES[1].image!,
    vibe: CATEGORIES[1].vibe || { fr: '', en: '' }
  },
  'cat-liquid': {
    image: CATEGORIES[2].image!,
    vibe: CATEGORIES[2].vibe || { fr: '', en: '' }
  }
};

export const MENU_ITEMS: MenuItem[] = [
  {
    id: 'dish-griot-royale',
    name: { fr: 'Griot Royale', en: 'Royal Griot' },
    description: {
      fr: 'Porc mariné, pikliz flamboyant, plantains rôtis et sauce ti-malice.',
      en: 'Marinated pork, fiery pikliz, roasted plantains and ti-malice sauce.'
    },
    price: 28,
    image: 'https://images.unsplash.com/photo-1473093226795-af9932fe5856?auto=format&fit=crop&w=1200&q=80',
    category: 'cat-signature',
    ingredients: [
      { fr: 'Porc fermier', en: 'Farm pork' },
      { fr: 'Pikliz', en: 'Pikliz slaw' },
      { fr: 'Plantain', en: 'Plantain' }
    ],
    allergens: ['Spicy'],
    isBestSeller: true
  },
  {
    id: 'dish-lakou-mer',
    name: { fr: 'Lakou de la Mer', en: 'Lakou from the Sea' },
    description: {
      fr: 'Crevettes jerk, lait de coco fumé, riz djon djon et mangue verte.',
      en: 'Jerk shrimp, smoked coconut milk, djon djon rice, green mango.'
    },
    price: 32,
    image: 'https://images.unsplash.com/photo-1455619452474-d2be8b1e70cd?auto=format&fit=crop&w=1200&q=80',
    category: 'cat-signature',
    ingredients: [
      { fr: 'Crevettes', en: 'Shrimps' },
      { fr: 'Riz djon djon', en: 'Djon djon rice' },
      { fr: 'Mangue verte', en: 'Green mango' }
    ],
    allergens: ['Shellfish', 'Spicy']
  },
  {
    id: 'dish-sunrise-pancakes',
    name: { fr: 'Pancakes Soleil', en: 'Sunrise Pancakes' },
    description: {
      fr: 'Pancakes à la patate douce, sirop épicé et ricotta fouettée.',
      en: 'Sweet potato pancakes, spiced syrup, whipped ricotta.'
    },
    price: 19,
    image: 'https://images.unsplash.com/photo-1484723091739-30a097e8f929?auto=format&fit=crop&w=1200&q=80',
    category: 'cat-brunch',
    ingredients: [
      { fr: 'Patate douce', en: 'Sweet potato' },
      { fr: 'Ricotta', en: 'Ricotta' },
      { fr: 'Sirop aux épices', en: 'Spiced syrup' }
    ],
    allergens: ['Dairy', 'Gluten']
  },
  {
    id: 'dish-dous-mimo',
    name: { fr: 'Dous Mimo', en: 'Dous Mimo' },
    description: {
      fr: 'Mimosa au champagne rosé, sorbet passion et fleur d’hibiscus.',
      en: 'Rosé mimosa, passion sorbet, hibiscus blossom.'
    },
    price: 14,
    image: 'https://images.unsplash.com/photo-1481391032119-d89fee407e44?auto=format&fit=crop&w=800&q=80',
    category: 'cat-liquid',
    ingredients: [
      { fr: 'Champagne rosé', en: 'Rosé champagne' },
      { fr: 'Fruit de la passion', en: 'Passion fruit' },
      { fr: 'Hibiscus', en: 'Hibiscus' }
    ],
    allergens: []
  },
  {
    id: 'dish-ti-punch-nuit',
    name: { fr: 'Ti-Punch de Nuit', en: 'Midnight Ti-Punch' },
    description: {
      fr: 'Rhum épicé, sirop canne brûlé, lime confite et fumée de cacao.',
      en: 'Spiced rum, burnt cane syrup, preserved lime, cacao smoke.'
    },
    price: 16,
    image: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=800&q=80',
    category: 'cat-liquid',
    ingredients: [
      { fr: 'Rhum épicé', en: 'Spiced rum' },
      { fr: 'Sirop de canne', en: 'Cane syrup' },
      { fr: 'Lime confite', en: 'Preserved lime' }
    ],
    allergens: []
  }
];

export const FALLBACK_ORGANIZATION: OrganizationProfile = {
  id: 'demo-org',
  name: 'Café du Griot',
  slug: 'cafe-du-griot',
  street: '123 Rue Sainte-Catherine',
  city: 'Montréal',
  region: 'QC',
  postal_code: 'H2X 1Z6',
  country: 'Canada',
  address_json: null,
  address_text: '123 Rue Sainte-Catherine, Montréal, QC',
  settings: {
    fulfillment_types: ['pickup', 'delivery'],
    default_prep_time_minutes: 20,
    tax_rate: 0.1495
  },
  business_hours: Array.from({ length: 7 }).map((_, idx) => ({
    day_of_week: idx,
    open_time: '11:00',
    close_time: '23:00',
    is_closed: false
  }))
};

export const REVIEWS: StorefrontReview[] = [
  {
    id: 'r1',
    author: 'Jean-Luc M.',
    rating: 5,
    comment: {
      fr: 'Le meilleur griot de Montréal, point final. Le pikliz est parfaitement piquant.',
      en: 'The best griot in Montreal, period. The pikliz is perfectly spicy.'
    },
    avatar: 'https://i.pravatar.cc/150?u=jean',
    images: ['https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?auto=format&fit=crop&q=80&w=400']
  },
  {
    id: 'r2',
    author: 'Sarah D.',
    rating: 5,
    comment: {
      fr: 'Une explosion de saveurs. Le riz djon djon est incroyable.',
      en: 'An explosion of flavors. The djon djon rice is incredible.'
    },
    avatar: 'https://i.pravatar.cc/150?u=sarah',
    images: []
  }
];

export const NEWS: NewsPost[] = [
  {
    id: 'n1',
    title: { fr: 'Festival Kompa Night', en: 'Kompa Night Festival' },
    date: { fr: '20 Jan 2025', en: 'Jan 20, 2025' },
    excerpt: {
      fr: 'Une soirée de musique live et de danse pour célébrer la culture haïtienne.',
      en: 'A night of live music and dance celebrating Haitian culture.'
    },
    image: 'https://images.unsplash.com/photo-1514525253361-bee8718a74af?auto=format&fit=crop&q=80&w=800'
  }
];

// Helper Selectors
export const getItemsByCategory = (categoryId: string) =>
  MENU_ITEMS.filter(item => item.category === categoryId);

export const getPopularItems = (categoryId: string, limit = 5) =>
  MENU_ITEMS.filter(item => item.category === categoryId).slice(0, limit);

// Correctly uses the imported LocalizedString type
export const getLocalizedText = (lang: Language, str: LocalizedString) =>
  str[lang] || str['en'];
