
import React from 'react';
import { CATEGORIES } from '../constants';
import { Language, Category } from '../types';

interface Props {
  lang: Language;
  activeId: string;
  onSelect: (id: string) => void;
  categories?: Category[];
}

export const CategoryPills: React.FC<Props> = ({ lang, activeId, onSelect, categories = CATEGORIES }) => {
  const displayCategories = (categories && categories.length > 0) ? categories : CATEGORIES;

  return (
    <div className="flex items-center gap-3 overflow-x-auto no-scrollbar py-2 w-max max-w-full justify-center md:justify-start lg:justify-center scroll-smooth snap-x px-4">
      {displayCategories.map((cat) => {
        const isActive = activeId === cat.id;
        return (
          <button
            key={cat.id}
            onClick={() => onSelect(cat.id)}
            className={`whitespace-nowrap px-3 py-1 rounded-sm text-[9px] font-black uppercase tracking-[0.2em] transition-all duration-300 border snap-center ${isActive
              ? `bg-pink-600 text-white border-pink-600`
              : 'bg-white/5 text-white/40 border-white/10 hover:bg-white/10 hover:text-white/70'
              }`}
          >
            {cat.label[lang]}
          </button>
        );
      })}
    </div>
  );
};
