
import { MenuItem, Category, ThemeConfig, Review, NewsPost, Language, LocalizedString } from './types';

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
  reviewSub: { fr: "Des milliers de Montréalais ont déjà succombé au Griot.", en: "Thousands of Montrealers have already fallen for the Griot." }
};

export const CATEGORIES: Category[] = [
  { id: 'mains', label: { fr: 'Nos Plats 🍛', en: 'Our Dishes 🍛' } },
  { id: 'starters', label: { fr: 'Entrées 🥟', en: 'Starters 🥟' } },
  { id: 'sides', label: { fr: 'Extras 🔥', en: 'Sides 🔥' } },
  { id: 'drinks', label: { fr: 'Drinks 🍹', en: 'Drinks 🍹' } }
];

export const CATEGORY_METADATA: Record<string, { image: string; vibe: Record<Language, string> }> = {
  mains: {
    image: 'https://images.unsplash.com/photo-1544124499-58912cbddaad?auto=format&fit=crop&q=80&w=800',
    vibe: { fr: 'Griot & Djon djon mood 🍛', en: 'Griot & Djon djon mood 🍛' }
  },
  starters: {
    image: 'https://images.unsplash.com/photo-1626074353765-517a681e40be?auto=format&fit=crop&q=80&w=800',
    vibe: { fr: 'Croustillant & Épicé 🥟', en: 'Crispy & Spicy 🥟' }
  },
  sides: {
    image: 'https://images.unsplash.com/photo-1590080875515-8a3a8dc5735e?auto=format&fit=crop&q=80&w=800',
    vibe: { fr: 'Bananes & Pikliz vibes 🔥', en: 'Plantains & Pikliz vibes 🔥' }
  },
  drinks: {
    image: 'https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?auto=format&fit=crop&q=80&w=800',
    vibe: { fr: 'Fresh & Papaya flow 🍹', en: 'Fresh & Papaya flow 🍹' }
  }
};

export const MENU_ITEMS: MenuItem[] = [
  // MAINS
  {
    id: 'm1',
    name: { fr: 'Griot Classique', en: 'Classic Griot' },
    description: { fr: 'Porc mariné, bouilli puis frit à la perfection.', en: 'Marinated pork, boiled then fried to perfection.' },
    price: 19,
    image: 'https://images.unsplash.com/photo-1544124499-58912cbddaad?auto=format&fit=crop&q=80&w=1200',
    category: 'mains',
    ingredients: [{ fr: 'Porc frit', en: 'Fried Pork' }, { fr: 'Epis', en: 'Epis' }, { fr: 'Pikliz', en: 'Pikliz' }],
    allergens: ['Spicy'],
    isBestSeller: true
  },
  {
    id: 'm2',
    name: { fr: 'Tassot Cabrit', en: 'Fried Goat' },
    description: { fr: 'Chèvre frit croustillant, mariné au citron vert.', en: 'Crispy fried goat, marinated in lime.' },
    price: 24,
    image: 'https://images.unsplash.com/photo-1512058560366-cd2427ff5673?auto=format&fit=crop&q=80&w=1200',
    category: 'mains',
    ingredients: [{ fr: 'Chèvre', en: 'Goat' }, { fr: 'Citron', en: 'Lime' }],
    allergens: ['Spicy']
  },
  {
    id: 'm3',
    name: { fr: 'Poulet en Sauce', en: 'Stewed Chicken' },
    description: { fr: 'Poulet mijoté aux épices créoles et poivrons.', en: 'Slow cooked spicy chicken with creole spices.' },
    price: 18,
    image: 'https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?auto=format&fit=crop&q=80&w=1200',
    category: 'mains',
    ingredients: [{ fr: 'Poulet', en: 'Chicken' }, { fr: 'Poivrons', en: 'Peppers' }],
    allergens: ['Spicy']
  },
  {
    id: 'm4',
    name: { fr: 'Légume Haïtien', en: 'Haitian Stew' },
    description: { fr: 'Mélange onctueux de légumes et chair de crabe.', en: 'Rich mixed vegetable stew with crab meat.' },
    price: 22,
    image: 'https://images.unsplash.com/photo-1547592166-23ac45744acd?auto=format&fit=crop&q=80&w=1200',
    category: 'mains',
    ingredients: [{ fr: 'Aubergine', en: 'Eggplant' }, { fr: 'Crabe', en: 'Crab' }],
    allergens: ['Shellfish']
  },
  // STARTERS
  {
    id: 's1',
    name: { fr: 'Acra de Malanga', en: 'Malanga Acra' },
    description: { fr: 'Beignets de malanga croustillants aux fines herbes.', en: 'Crispy malanga fritters with fine herbs.' },
    price: 9,
    image: 'https://images.unsplash.com/photo-1626074353765-517a681e40be?auto=format&fit=crop&q=80&w=1200',
    category: 'starters',
    ingredients: [{ fr: 'Malanga', en: 'Malanga' }],
    allergens: ['Vegan']
  },
  {
    id: 's2',
    name: { fr: 'Pâté Kodé', en: 'Fried Patties' },
    description: { fr: 'Chaussons frits épicés fourrés au hareng ou poulet.', en: 'Spicy fried dough patties filled with herring or chicken.' },
    price: 11,
    image: 'https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?auto=format&fit=crop&q=80&w=1200',
    category: 'starters',
    ingredients: [{ fr: 'Farine', en: 'Flour' }, { fr: 'Hareng', en: 'Herring' }],
    allergens: ['Gluten']
  },
  // ... more items can be added here
];

export const REVIEWS: Review[] = [
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
