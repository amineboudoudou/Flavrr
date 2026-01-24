
import React from 'react';
import { CATEGORIES, MENU_ITEMS, CATEGORY_METADATA, UI_STRINGS } from '../constants';
import { Category, Language, MenuItem } from '../types';

interface Props {
  lang: Language;
  onCategoryClick: (category: Category) => void;
}

interface Props {
  lang: Language;
  onCategoryClick: (category: Category) => void;
  categories?: Category[];
  menuItems?: MenuItem[];
}

export const MenuByCategorySection: React.FC<Props> = ({
  lang,
  onCategoryClick,
  categories = CATEGORIES,
  menuItems = MENU_ITEMS
}) => {
  const displayCategories = categories.length > 0 ? categories : CATEGORIES;
  const displayItems = menuItems.length > 0 ? menuItems : MENU_ITEMS;

  return (
    <div className="w-full max-w-[1400px] mx-auto px-6 py-24 space-y-16">
      {/* ... header content ... */}
      <div className="space-y-4 text-center md:text-left">
        <h2 className="text-pink-500 uppercase tracking-[0.3em] text-xs font-bold">{lang === 'fr' ? "L'exploration commence ici" : "Exploration starts here"}</h2>
        <h1 className="text-5xl md:text-7xl font-serif text-white">{UI_STRINGS.catHeader[lang]}</h1>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <p className="text-white/40 max-w-md text-lg italic">
            {UI_STRINGS.catSub[lang]}
          </p>
          <span className="text-[10px] text-white/20 uppercase tracking-[0.2em] font-bold">{UI_STRINGS.catTap[lang]}</span>
        </div>
      </div>

      <div className="flex overflow-x-auto md:grid md:grid-cols-2 lg:grid-cols-4 gap-6 no-scrollbar snap-x snap-mandatory pb-4">
        {displayCategories.map((cat) => {
          const categoryItems = displayItems.filter(item => item.category === cat.id);
          const previewItems = categoryItems.slice(0, 4);
          const itemCount = categoryItems.length;
          const meta = CATEGORY_METADATA[cat.id] || CATEGORY_METADATA['mains'];

          return (
            <div
              key={cat.id}
              onClick={() => onCategoryClick(cat)}
              className="group relative flex-shrink-0 w-[85%] md:w-auto aspect-[3/4] rounded-[2.5rem] overflow-hidden cursor-pointer snap-center border border-white/5 transition-all duration-500 hover:border-pink-500/30 hover:-translate-y-2 shadow-2xl"
            >
              {/* Main Category Image */}
              <img
                src={meta.image}
                alt={cat.label[lang]}
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 group-hover:blur-[2px]"
              />

              {/* Default Overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent transition-opacity duration-500 group-hover:opacity-0" />

              {/* Hover Menu Overlay */}
              <div className="absolute inset-0 bg-black/80 backdrop-blur-md opacity-0 group-hover:opacity-100 transition-all duration-500 p-8 flex flex-col justify-start">
                <div className="flex justify-between items-center mb-8">
                  <span className="text-pink-500 text-[10px] font-black tracking-[0.3em] uppercase">SURVOL DU MENU</span>
                  <span className="text-white/40 text-[9px] uppercase font-bold">{itemCount} PLATS</span>
                </div>

                <div className="space-y-6 flex-1">
                  {previewItems.map((item) => {
                    const itemImg = item.image.startsWith('/')
                      ? `https://images.unsplash.com/photo-1544124499-58912cbddaad?auto=format&fit=crop&q=80&w=400`
                      : item.image;
                    return (
                      <div key={item.id} className="flex justify-between items-center group/item transition-all hover:translate-x-1">
                        <div className="flex-1 pr-4">
                          <h4 className="text-white text-sm font-serif leading-tight">{item.name[lang]}</h4>
                          <div className="flex items-center gap-2 mt-0.5">
                            <p className="text-pink-500 text-[11px] font-bold">${item.price}</p>
                            {item.isBestSeller && (
                              <span className="bg-pink-600 text-white text-[6px] px-1 py-0.5 font-black uppercase tracking-[0.1em] rounded-sm">BEST SELLER</span>
                            )}
                          </div>
                        </div>
                        <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 border border-white/10 ring-2 ring-transparent group-hover/item:ring-pink-500/50 transition-all">
                          <img src={itemImg} className="w-full h-full object-cover" alt={item.name[lang]} />
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-auto pt-6 border-t border-white/10">
                  <p className="text-[10px] text-white/40 uppercase tracking-widest text-center animate-pulse">
                    {lang === 'fr' ? 'Tap pour voir la suite' : 'Tap to see more'}
                  </p>
                </div>
              </div>

              {/* Bottom Content (Always visible/Slide down on hover) */}
              <div className="absolute inset-0 p-8 flex flex-col justify-end space-y-3 pointer-events-none group-hover:translate-y-full transition-transform duration-500">
                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 bg-pink-600 text-white text-[10px] font-bold rounded-full shadow-lg shadow-pink-900/40">
                    {itemCount} {lang === 'fr' ? 'Plats' : 'Dishes'}
                  </span>
                </div>
                <h3 className="text-3xl md:text-4xl text-white font-serif leading-none tracking-tight">
                  {cat.label[lang]}
                </h3>
                <p className="text-white/60 text-xs tracking-wide uppercase font-medium">
                  {meta.vibe[lang]}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
