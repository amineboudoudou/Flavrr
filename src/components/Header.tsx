
import React from 'react';
import { ShoppingCart, LogoIcon, User } from './Icons';
import { CategoryPills } from './CategoryPills';
import { Language } from '../types';

interface Props {
  lang: Language;
  onLangChange: (l: Language) => void;
  activeCategory: string;
  onCategoryChange: (id: string) => void;
  cartCount: number;
  onCartOpen: () => void;
  categories?: any[];
}

export const Header: React.FC<Props> = ({
  lang,
  onLangChange,
  activeCategory,
  onCategoryChange,
  cartCount,
  onCartOpen,
  categories
}) => {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-black/60 backdrop-blur-xl border-b border-white/5">
      <div className="max-w-[1800px] mx-auto flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-4">
          <div className="text-pink-500">
            <LogoIcon className="w-10 h-10 md:w-12 md:h-12" />
          </div>
          <div className="flex flex-col">
            <span className="text-white font-serif tracking-[0.1em] text-xl md:text-2xl font-bold leading-none">CAFÉ DU GRIOT</span>
            <div className="mt-1 flex items-center gap-2">
              <span className="bg-pink-600 text-white text-[9px] px-2 py-0.5 font-bold uppercase tracking-[0.2em] rounded-sm whitespace-nowrap">BAR RESTO</span>
            </div>
          </div>
        </div>

        <div className="flex-1 hidden sm:flex items-center justify-center px-4 gap-4">
          <div className="h-4 w-[1px] bg-white/10 hidden lg:block" />
          <div className="flex items-center gap-2">
            <span className="text-[9px] font-black text-white/20 uppercase tracking-[0.3em] hidden xl:block">Menu</span>
            <CategoryPills lang={lang} activeId={activeCategory} onSelect={onCategoryChange} categories={categories} />
          </div>
          <div className="h-4 w-[1px] bg-white/10 hidden lg:block" />
        </div>

        <div className="flex items-center gap-2 md:gap-6">
          {/* Language Toggle */}
          <div className="flex items-center bg-white/5 rounded-full p-1 border border-white/10 scale-90 md:scale-100">
            <button
              onClick={() => onLangChange('fr')}
              className={`px-3 py-1 text-[10px] font-bold rounded-full transition-all ${lang === 'fr' ? 'bg-pink-600 text-white' : 'text-white/40 hover:text-white'}`}
            >
              FR
            </button>
            <button
              onClick={() => onLangChange('en')}
              className={`px-3 py-1 text-[10px] font-bold rounded-full transition-all ${lang === 'en' ? 'bg-pink-600 text-white' : 'text-white/40 hover:text-white'}`}
            >
              EN
            </button>
          </div>

          <button
            onClick={onCartOpen}
            className="relative p-2 text-white hover:text-pink-500 transition-colors"
          >
            <ShoppingCart className="w-6 h-6" />
            {cartCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-pink-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-black">
                {cartCount}
              </span>
            )}
          </button>

          <a
            href="/login"
            className="flex items-center gap-2 bg-white/5 hover:bg-white/10 text-white/60 hover:text-white md:px-4 p-2 md:py-2 rounded-full border border-white/10 transition-all text-[10px] font-bold uppercase tracking-widest"
            title="Owner Portal"
          >
            <User className="w-5 h-5 md:w-4 md:h-4" />
            <span className="hidden md:inline">Owner</span>
          </a>
        </div>
      </div>

    </header>
  );
};
