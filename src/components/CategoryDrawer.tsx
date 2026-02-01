
import React from 'react';
import { Category, MenuItem, Language } from '../types';
import { X, Plus } from './Icons';
import { UI_STRINGS } from '../constants';

interface Props {
  lang: Language;
  isOpen: boolean;
  onClose: () => void;
  category: Category | null;
  items: MenuItem[];
  onAddToCart: (item: MenuItem, quantity: number) => void;
  onJumpToItem: (id: string) => void;
}

export const CategoryDrawer: React.FC<Props> = ({ lang, isOpen, onClose, category, items, onAddToCart, onJumpToItem }) => {
  if (!isOpen || !category) return null;

  return (
    <div className="fixed inset-0 z-[110] flex justify-end">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={onClose} />
      <div className="relative w-full md:w-[550px] bg-[#0a0a0a] h-full shadow-2xl flex flex-col animate-slide-in-right border-l border-white/5">
        <div className="p-8 border-b border-white/5 flex items-center justify-between">
          <div className="space-y-1">
            <h2 className="text-3xl font-serif text-white">{category.label[lang]}</h2>
            <p className="text-pink-500 text-[10px] uppercase font-bold tracking-widest">{UI_STRINGS.exploreSelection[lang]}</p>
          </div>
          <button onClick={onClose} className="p-3 bg-white/5 rounded-full text-white/50 hover:text-white transition-all">
            <X />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6 no-scrollbar">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex gap-4 p-4 rounded-2xl bg-white/5 border border-white/5 hover:border-pink-500/30 transition-all group"
            >
              <div
                className="w-24 h-24 rounded-xl overflow-hidden flex-shrink-0 cursor-pointer"
                onClick={() => onJumpToItem(item.id)}
              >
                <img
                  src={item.image.startsWith('/')
                    ? `https://images.unsplash.com/photo-1544124499-58912cbddaad?auto=format&fit=crop&q=80&w=400`
                    : item.image}
                  alt={item.name[lang]}
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                />
              </div>
              <div className="flex-1 flex flex-col justify-between min-w-0">
                <div className="space-y-1">
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex flex-col gap-1 min-w-0">
                      <h3 className="font-serif text-lg text-white truncate">{item.name[lang]}</h3>
                      {item.isBestSeller && (
                        <span className="w-fit bg-pink-600 text-white text-[7px] px-1.5 py-0.5 font-black uppercase tracking-[0.2em] rounded-sm">BEST SELLER</span>
                      )}
                    </div>
                    <span className="text-pink-500 font-bold whitespace-nowrap">${item.price}</span>
                  </div>
                  <p className="text-white/40 text-xs leading-relaxed line-clamp-2 italic">
                    {item.description[lang]}
                  </p>
                </div>
                <div className="flex justify-between items-center mt-2">
                  <div className="flex gap-1.5">
                    {item.allergens.slice(0, 2).map(a => (
                      <span key={a} className="text-[9px] bg-white/5 px-2 py-0.5 rounded text-white/30">{a}</span>
                    ))}
                  </div>
                  <button
                    onClick={() => onAddToCart(item, 1)}
                    className="p-2 bg-pink-600 text-white rounded-lg hover:bg-pink-500 transition-all hover:scale-105 active:scale-95 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider px-3"
                  >
                    <Plus className="w-3 h-3" /> {lang === 'fr' ? 'Ajouter' : 'Add'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="p-8 border-t border-white/5 bg-black/40">
          <p className="text-[10px] text-white/20 text-center uppercase tracking-widest italic">
            {UI_STRINGS.tapToFull[lang]}
          </p>
        </div>
      </div>

      <style>{`
        @keyframes slide-in-right {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        .animate-slide-in-right {
          animation: slide-in-right 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        }
      `}</style>
    </div>
  );
};
