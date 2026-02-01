import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { MenuItem, CartItem, Category, Language, OrganizationProfile, CheckoutStep } from './types';
import { MENU_ITEMS, CATEGORIES, UI_STRINGS } from './constants';
import { Header } from './components/Header';
import { PlateCard } from './components/PlateCard';
import { CartDrawer } from './components/CartDrawer';
import { CategoryDrawer } from './components/CategoryDrawer';
import { DishDetailsModal } from './components/DishDetailsModal';
import { MenuByCategorySection } from './components/MenuByCategorySection';
import { DishGallery } from './components/DishGallery';
import { Toast } from './components/Toast';
import { ChevronLeft, ChevronRight, ShoppingCart } from './components/Icons';
import { DeliveryView } from './components/DeliveryView';
import { ReviewsView } from './components/ReviewsView';
import { BookingView } from './components/BookingView';
import { NewsView } from './components/NewsView';
import { CheckoutFlow } from './components/CheckoutFlow';
import { useImagePreload } from './hooks/useImagePreload';
import { api } from './lib/api';

const Storefront: React.FC = () => {
    const [lang, setLang] = useState<Language>('fr');
    const [categories, setCategories] = useState<Category[]>([]);
    const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
    const [activeCategory, setActiveCategory] = useState<string>('');
    const [currentIndex, setCurrentIndex] = useState(0);
    const [cart, setCart] = useState<CartItem[]>([]);
    const [isCartOpen, setIsCartOpen] = useState(false);
    const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
    const [checkoutInitialStep, setCheckoutInitialStep] = useState<CheckoutStep>('ITEMS');
    const [checkoutInitialToken, setCheckoutInitialToken] = useState<string>('');
    const [toastMessage, setToastMessage] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [organization, setOrganization] = useState<OrganizationProfile | null>(null);

    // Modal/Drawer states
    const [selectedCategoryForDrawer, setSelectedCategoryForDrawer] = useState<Category | null>(null);
    const [isCategoryDrawerOpen, setIsCategoryDrawerOpen] = useState(false);
    const [selectedItemForDetails, setSelectedItemForDetails] = useState<MenuItem | null>(null);
    const [isDetailsOpen, setIsDetailsOpen] = useState(false);

    const ORG_ID = '00000000-0000-0000-0000-000000000001';

    useEffect(() => {
        let isMounted = true;
        const loadMenu = async () => {
            console.log('🔄 Loading menu data...');
            try {
                if (isMounted) setLoading(true);

                const response = await api.publicGetMenu('cafe-du-griot');

                console.log(`✅ Loaded ${response.menu.length} categories.`);

                if (isMounted) {
                    setOrganization(response.organization);
                    setCategories(response.menu || []);

                    // Flatten items for internal use
                    const allItems = response.menu.reduce((acc: MenuItem[], cat: any) => {
                        return [...acc, ...cat.items];
                    }, []);
                    setMenuItems(allItems);

                    if (response.menu && response.menu.length > 0) {
                        setActiveCategory(response.menu[0].id);
                    }
                }
            } catch (error: any) {
                if (error.message === 'TIMEOUT') {
                    console.warn('⚠️ Menu fetch timed out. Check Supabase connectivity.');
                    setToastMessage('Menu load taking longer than expected...');
                } else if (error.name === 'AbortError' || error.message?.includes('aborted')) {
                    console.log('ℹ️ Component navigation or strict mode aborted fetch.');
                } else {
                    console.error('❌ Failed to load menu:', error);
                    setToastMessage('Failed to load menu data');
                }
            } finally {
                if (isMounted) {
                    console.log('🏁 Loading state cleared.');
                    setLoading(false);
                }
            }
        };
        loadMenu();
        return () => { isMounted = false; };
    }, []);

    const filteredItems = useMemo(() => {
        if (!activeCategory) return [];
        return menuItems.filter(item => item.category === activeCategory);
    }, [activeCategory, menuItems]);

    // Preload URLs for smooth swiping
    const preloadUrls = useMemo(() => filteredItems.map(item => item.image), [filteredItems]);
    useImagePreload(preloadUrls);

    const scrollToSection = (id: string) => {
        const el = document.getElementById(id);
        if (el) {
            el.scrollIntoView({ behavior: 'smooth' });
        }
    };

    const handleCategoryChange = (id: string) => {
        console.log(`📂 Switching to category: ${id}`);
        setActiveCategory(id);
        setCurrentIndex(0);
        scrollToSection('menu');
    };

    const handleAddToCart = (item: MenuItem, quantity: number) => {
        setCart(prev => {
            const existing = prev.find(i => i.id === item.id);
            if (existing) {
                return prev.map(i => i.id === item.id ? { ...i, quantity: i.quantity + quantity } : i);
            }
            const { name, ...rest } = item;
            return [...prev, { ...rest, name, quantity }];
        });
        const message = lang === 'fr' ? `${item.name.fr} ajouté !` : `${item.name.en} added!`;
        setToastMessage(message);
    };

    const handleCategorySectionClick = (category: Category) => {
        console.log(`🔍 Category Explorer click: ${category.id}`);
        handleCategoryChange(category.id);
    };

    const handleJumpToItem = (itemId: string) => {
        const item = menuItems.find(i => i.id === itemId);
        if (item) {
            console.log(`🎯 Jumping to item: ${itemId} in ${item.category}`);
            setActiveCategory(item.category);
            // Small delay to ensure filteredItems has updated before we set the index
            setTimeout(() => {
                const indexInCat = menuItems
                    .filter(i => i.category === item.category)
                    .findIndex(i => i.id === itemId);

                setCurrentIndex(indexInCat >= 0 ? indexInCat : 0);
                scrollToSection('menu');
                setIsCategoryDrawerOpen(false);
            }, 0);
        }
    };

    const handleOpenDetails = (item: MenuItem) => {
        setSelectedItemForDetails(item);
        setIsDetailsOpen(true);
    };

    const handleJumpToIndex = (index: number) => {
        setCurrentIndex(index);
    };

    const handleCheckout = () => {
        setIsCartOpen(false);
        setIsCheckoutOpen(true);
    };

    const cartCount = useMemo(() => cart.reduce((sum, item) => sum + item.quantity, 0), [cart]);
    const cartTotal = useMemo(() => cart.reduce((sum, item) => sum + item.price * item.quantity, 0), [cart]);

    const nextItem = useCallback(() => {
        if (filteredItems.length === 0) return;

        if (currentIndex < filteredItems.length - 1) {
            setCurrentIndex(prev => prev + 1);
        } else {
            // Reached the end of current category, find next non-empty category
            const currentCatIndex = categories.findIndex(c => c.id === activeCategory);
            for (let i = 1; i <= categories.length; i++) {
                const nextCatIndex = (currentCatIndex + i) % categories.length;
                const nextCat = categories[nextCatIndex];
                const itemsInCat = menuItems.filter(item => item.category === nextCat.id);
                if (itemsInCat.length > 0) {
                    console.log(`➡️ End of category reached. Moving to next category: ${nextCat.id}`);
                    setActiveCategory(nextCat.id);
                    setCurrentIndex(0);
                    return;
                }
            }
            // Fallback: just wrap to start of same category if no other options
            setCurrentIndex(0);
        }
    }, [filteredItems, currentIndex, activeCategory, categories, menuItems]);

    const prevItem = useCallback(() => {
        if (filteredItems.length === 0) return;

        if (currentIndex > 0) {
            setCurrentIndex(prev => prev - 1);
        } else {
            // Reached the start of current category, find previous non-empty category
            const currentCatIndex = categories.findIndex(c => c.id === activeCategory);
            for (let i = 1; i <= categories.length; i++) {
                const prevCatIndex = (currentCatIndex - i + categories.length) % categories.length;
                const prevCat = categories[prevCatIndex];
                const itemsInCat = menuItems.filter(item => item.category === prevCat.id);
                if (itemsInCat.length > 0) {
                    console.log(`⬅️ Start of category reached. Moving to previous category: ${prevCat.id}`);
                    setActiveCategory(prevCat.id);
                    setCurrentIndex(itemsInCat.length - 1);
                    return;
                }
            }
            // Fallback: just wrap to end of same category if no other options
            setCurrentIndex(filteredItems.length - 1);
        }
    }, [filteredItems, currentIndex, activeCategory, categories, menuItems]);

    // Global Accessibility: Close all layers on Escape
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                setIsCartOpen(false);
                setIsCategoryDrawerOpen(false);
                setIsDetailsOpen(false);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    // Handle Stripe Redirect Return
    useEffect(() => {
        const searchParams = new URLSearchParams(window.location.search);
        if (searchParams.get('success') === 'true') {
            const token = searchParams.get('token');
            if (token) {
                setCheckoutInitialToken(token);
                setCheckoutInitialStep('SUCCESS');
                setIsCheckoutOpen(true);
                // Clean URL
                window.history.replaceState({}, '', '/');
                setCart([]); // Clear cart
            }
        }
    }, []);

    if (loading) {
        return (
            <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-pink-600 border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-pink-500 font-serif tracking-widest animate-pulse">CHARGEMENT DU MENU...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="relative bg-[#0a0a0a] flex flex-col font-sans overflow-x-hidden selection:bg-pink-500 selection:text-white">
            <Header
                lang={lang}
                onLangChange={setLang}
                activeCategory={activeCategory}
                onCategoryChange={handleCategoryChange}
                cartCount={cartCount}
                onCartOpen={() => setIsCartOpen(true)}
                categories={categories}
            />

            <main className="flex flex-col">
                {/* HERO SECTION - Immersive Swipe Menu */}
                <section id="menu" className="relative h-screen w-full flex-shrink-0">
                    <div className="relative w-full h-full overflow-hidden">
                        {filteredItems.length > 0 ? (
                            filteredItems.map((item, idx) => (
                                <div
                                    key={item.id}
                                    className={`absolute inset-0 transition-all duration-700 ease-in-out ${idx === currentIndex
                                        ? 'opacity-100 translate-x-0 z-20 scale-100'
                                        : idx < currentIndex
                                            ? 'opacity-0 -translate-x-full z-10 scale-95'
                                            : 'opacity-0 translate-x-full z-10 scale-95'
                                        }`}
                                >
                                    <PlateCard
                                        lang={lang}
                                        item={item}
                                        onAddToCart={handleAddToCart}
                                    />
                                </div>
                            ))
                        ) : (
                            <div className="flex items-center justify-center h-full w-full bg-black/40 backdrop-blur-sm">
                                <div className="text-center space-y-4">
                                    <p className="text-white/40 font-serif text-2xl italic tracking-widest uppercase">
                                        {lang === 'fr' ? 'À venir bientôt...' : 'Coming soon...'}
                                    </p>
                                    <p className="text-pink-500/60 text-[10px] uppercase font-bold tracking-[0.4em]">
                                        {lang === 'fr' ? 'Revenez plus tard pour découvrir nos nouveaux plats' : 'Check back later for new delicacies'}
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>

                    {filteredItems.length > 1 && (
                        <>
                            {/* Swipe Indicator for Mobile */}
                            <div className="absolute bottom-12 left-1/2 -translate-x-1/2 z-30 md:hidden flex flex-col items-center gap-2 pointer-events-none opacity-40">
                                <div className="flex gap-4 text-white">
                                    <ChevronLeft className="w-4 h-4 animate-pulse" />
                                    <span className="text-[10px] uppercase tracking-[0.3em] font-black">{UI_STRINGS.swipeHint[lang]}</span>
                                    <ChevronRight className="w-4 h-4 animate-pulse" />
                                </div>
                            </div>

                            {/* Desktop Navigation Arrows */}
                            <div className="hidden md:block">
                                <button
                                    onClick={prevItem}
                                    className="absolute left-6 top-1/2 -translate-y-1/2 z-30 p-5 bg-black/40 backdrop-blur-xl rounded-full text-white hover:bg-white hover:text-black transition-all border border-white/10"
                                    aria-label="Previous dish"
                                >
                                    <ChevronLeft />
                                </button>
                                <button
                                    onClick={nextItem}
                                    className="absolute right-[466px] lg:right-[516px] top-1/2 -translate-y-1/2 z-30 p-5 bg-black/40 backdrop-blur-xl rounded-full text-white hover:bg-white hover:text-black transition-all border border-white/10"
                                    aria-label="Next dish"
                                >
                                    <ChevronRight />
                                </button>
                            </div>
                        </>
                    )}
                </section>


                {/* CATEGORY EXPLORER - Grid with Hover Previews */}
                <section id="category-browser" className="bg-[#0a0a0a]">
                    <MenuByCategorySection
                        lang={lang}
                        onCategoryClick={(cat) => {
                            setSelectedCategoryForDrawer(cat);
                            setIsCategoryDrawerOpen(true);
                        }}
                        categories={categories}
                        menuItems={menuItems}
                    />
                </section>

                {/* Informational Sections */}
                <section id="delivery" className="min-h-screen w-full py-24 bg-neutral-900/50 flex items-center border-t border-white/5">
                    <DeliveryView lang={lang} />
                </section>

                {/* Dish Gallery Section */}
                <DishGallery
                    lang={lang}
                    items={menuItems}
                    onItemClick={(item) => {
                        setSelectedItemForDetails(item);
                        setIsDetailsOpen(true);
                    }}
                />

                <section id="reviews" className="min-h-screen w-full py-24 bg-black flex items-center">
                    <ReviewsView lang={lang} />
                </section>

                <section id="booking" className="min-h-screen w-full py-24 bg-neutral-900/50 flex items-center border-y border-white/5">
                    <BookingView lang={lang} />
                </section>

                <section id="news" className="min-h-screen w-full py-24 bg-black flex items-center">
                    <NewsView lang={lang} />
                </section>
            </main>

            {/* OVERLAYS: MODALS & DRAWERS */}
            <DishDetailsModal
                lang={lang}
                isOpen={isDetailsOpen}
                onClose={() => setIsDetailsOpen(false)}
                item={selectedItemForDetails}
                onAddToCart={handleAddToCart}
            />

            <CategoryDrawer
                lang={lang}
                isOpen={isCategoryDrawerOpen}
                onClose={() => setIsCategoryDrawerOpen(false)}
                category={selectedCategoryForDrawer}
                items={menuItems.filter(i => i.category === selectedCategoryForDrawer?.id)}
                onAddToCart={handleAddToCart}
                onJumpToItem={handleJumpToItem}
            />

            <CartDrawer
                lang={lang}
                isOpen={isCartOpen}
                onClose={() => setIsCartOpen(false)}
                items={cart}
                onUpdateQuantity={(id: string, delta: number) => setCart(p => p.map(i => i.id === id ? { ...i, quantity: Math.max(1, i.quantity + delta) } : i))}
                onRemove={(id: string) => setCart(p => p.filter(i => i.id !== id))}
                onCheckout={handleCheckout}
            />

            {cartCount > 0 && !isCartOpen && !isCheckoutOpen && (
                <div className="fixed inset-x-0 bottom-6 z-40 flex justify-center pointer-events-none px-4">
                    <button
                        onClick={() => setIsCartOpen(true)}
                        className="pointer-events-auto w-full max-w-md rounded-2xl bg-gradient-to-r from-pink-600 via-pink-500 to-orange-400 px-6 py-4 shadow-2xl shadow-pink-900/40 border border-white/10 backdrop-blur-xl flex items-center justify-between gap-4 text-left"
                        aria-label="Open cart"
                    >
                        <div className="flex-1">
                            <p className="text-white text-sm font-black uppercase tracking-[0.25em]">{UI_STRINGS.floatingCartCta[lang]}</p>
                            <p className="text-white/70 text-xs font-medium mt-1">{UI_STRINGS.floatingCartSubtitle[lang]}</p>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="text-right">
                                <p className="text-white font-serif text-2xl leading-none">${cartTotal.toFixed(2)}</p>
                                <span className="text-white/70 text-[10px] uppercase tracking-[0.3em]">{lang === 'fr' ? `${cartCount} article${cartCount > 1 ? 's' : ''}` : `${cartCount} item${cartCount > 1 ? 's' : ''}`}</span>
                            </div>
                            <div className="w-12 h-12 rounded-full bg-black/30 border border-white/20 flex items-center justify-center text-white">
                                <ShoppingCart className="w-5 h-5" />
                            </div>
                        </div>
                    </button>
                </div>
            )}

            <CheckoutFlow
                lang={lang}
                isOpen={isCheckoutOpen}
                onClose={() => {
                    setIsCheckoutOpen(false);
                    // Reset to default on close
                    setTimeout(() => {
                        setCheckoutInitialStep('ITEMS');
                        setCheckoutInitialToken('');
                    }, 300);
                }}
                items={cart}
                cartTotal={cartTotal}
                organization={organization}
                onSuccess={() => setCart([])}
                initialStep={checkoutInitialStep}
                initialToken={checkoutInitialToken}
            />

            {toastMessage && (
                <Toast message={toastMessage} onClose={() => setToastMessage(null)} />
            )}

            {/* FOOTER */}
            <footer className="bg-black py-20 border-t border-white/5">
                <div className="max-w-[1400px] mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-10">
                    <div className="flex flex-col items-center md:items-start space-y-2">
                        <span className="text-white font-serif text-2xl font-bold tracking-widest">CAFÉ DU GRIOT</span>
                        <span className="text-white/40 text-[10px] uppercase font-bold tracking-[0.4em]">SAVEUR AUTHENTIQUE HAÏTIENNE</span>
                    </div>
                    <p className="text-white/20 text-[10px] uppercase font-bold tracking-widest text-center">
                        &copy; {new Date().getFullYear()} CAFÉ DU GRIOT. TOUS DROITS RÉSERVÉS.
                    </p>
                    <div className="flex gap-8">
                        {['Instagram', 'Facebook', 'UberEats'].map(link => (
                            <a key={link} href="#" className="text-white/40 hover:text-pink-500 transition-colors text-[10px] uppercase font-bold tracking-widest">{link}</a>
                        ))}
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default Storefront;
