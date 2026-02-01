import React from 'react';
import { MenuItem, Language } from '../types';
import { X } from './Icons';
import { AllergenIcons } from './AllergenIcons';
import { UI_STRINGS } from '../constants';
import { QuantityStepper } from './QuantityStepper';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  item: MenuItem | null;
  lang: Language;
  onAddToCart: (item: MenuItem, quantity: number) => void;
}

export const DishDetailsModal: React.FC<Props> = ({ isOpen, onClose, item, lang, onAddToCart }) => {
  const [qty, setQty] = React.useState(1);

  React.useEffect(() => {
    if (isOpen) setQty(1);
  }, [isOpen]);

  if (!isOpen || !item) return null;

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 md:p-6">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/95 backdrop-blur-2xl animate-fade-in"
        onClick={onClose}
      />

      {/* Modal Content */}
      <div className="relative w-full max-w-4xl bg-[#0a0a0a] rounded-[2.5rem] overflow-hidden shadow-2xl border border-white/10 flex flex-col md:flex-row animate-scale-in max-h-[90vh] overflow-y-auto no-scrollbar">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-6 right-6 z-20 p-3 bg-black/50 backdrop-blur-md rounded-full text-white hover:bg-pink-600 transition-all border border-white/10"
          aria-label="Close details"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Image Section */}
        <div className="md:w-1/2 h-64 md:h-auto overflow-hidden relative">
          <img
            src={item.image.startsWith('/')
              ? `https://images.unsplash.com/photo-1544124499-58912cbddaad?auto=format&fit=crop&q=80&w=1200`
              : item.image}
            alt={item.name[lang]}
            className="w-full h-full object-cover brightness-110 saturate-[1.15] contrast-[1.05]"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-transparent to-transparent" />
        </div>

        {/* Content Section */}
        <div className="md:w-1/2 p-8 md:p-12 flex flex-col justify-center space-y-8">
          <div className="space-y-4">
            <span className="text-pink-500 uppercase tracking-[0.4em] text-[10px] font-black">
              {UI_STRINGS.chefChoice[lang]}
            </span>
            <h2 className="text-4xl md:text-5xl font-serif text-white leading-tight">
              {item.name[lang]}
            </h2>
            <p className="text-white/60 text-lg leading-relaxed italic">
              "{item.description[lang]}"
            </p>
          </div>

          <div className="space-y-6">
            <div className="space-y-3">
              <h4 className="text-white/30 uppercase tracking-[0.2em] text-[9px] font-bold">
                {lang === 'fr' ? 'INGRÉDIENTS PRINCIPAUX' : 'MAIN INGREDIENTS'}
              </h4>
              <div className="flex flex-wrap gap-2">
                {item.ingredients.map((ing, i) => (
                  <span key={i} className="px-3 py-1 bg-white/5 border border-white/10 rounded-full text-[11px] text-white/70">
                    {ing[lang]}
                  </span>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="text-white/30 uppercase tracking-[0.2em] text-[9px] font-bold">
                {lang === 'fr' ? 'ALLERGÈNES' : 'ALLERGENS'}
              </h4>
              <AllergenIcons allergens={item.allergens} />
            </div>
          </div>

          <div className="pt-6 flex flex-col sm:flex-row items-center gap-6 border-t border-white/5">
            <div className="flex-1 text-center sm:text-left">
              <span className="text-white/20 text-[10px] uppercase font-bold tracking-widest block mb-1">
                {UI_STRINGS.priceLabel[lang]}
              </span>
              <span className="text-4xl text-white font-serif">${item.price}</span>
            </div>

            <div className="flex items-center gap-4 w-full sm:w-auto">
              <QuantityStepper value={qty} onChange={setQty} className="bg-white/10 border-white/10" />
              <button
                onClick={() => {
                  onAddToCart(item, qty);
                  onClose();
                }}
                className="flex-1 sm:flex-none px-8 py-4 bg-pink-600 text-white font-bold rounded-2xl hover:bg-pink-500 transition-all hover:scale-105 active:scale-95 shadow-xl shadow-pink-900/20 uppercase tracking-widest text-[10px]"
              >
                {UI_STRINGS.addBtn[lang]}
              </button>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes scale-in {
          from { transform: scale(0.95); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
        .animate-fade-in { animation: fade-in 0.3s ease-out forwards; }
        .animate-scale-in { animation: scale-in 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
      `}</style>
    </div>
  );
};
