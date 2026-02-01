
import React, { useState } from 'react';
import { MenuItem, Language } from '../types';
import { AllergenIcons } from './AllergenIcons';
import { QuantityStepper } from './QuantityStepper';
import { UI_STRINGS } from '../constants';

interface Props {
  lang: Language;
  item: MenuItem;
  onAddToCart: (item: MenuItem, quantity: number) => void;
}

export const PlateCard: React.FC<Props> = ({ lang, item, onAddToCart }) => {
  const [qty, setQty] = useState(1);

  const handleAdd = () => {
    onAddToCart(item, qty);
    setQty(1);
  };

  const imageUrl = item.image.startsWith('/')
    ? `https://images.unsplash.com/photo-1544124499-58912cbddaad?auto=format&fit=crop&q=80&w=1200`
    : item.image;

  return (
    <div className="relative w-full h-full flex flex-col md:flex-row overflow-hidden bg-[#0a0a0a]">
      <div className="absolute inset-0 md:relative md:flex-1 h-full overflow-hidden">
        <img
          src={imageUrl}
          alt={item.name[lang]}
          className="w-full h-full object-cover brightness-[0.6] md:brightness-90 transition-transform duration-[10s] hover:scale-110"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-transparent to-transparent md:hidden" />
      </div>

      <div className="absolute bottom-0 left-0 right-0 md:relative md:w-[480px] lg:w-[550px] h-fit md:h-full bg-black/50 md:bg-[#111] backdrop-blur-2xl md:backdrop-blur-none p-8 md:p-14 flex flex-col justify-end md:justify-center border-t md:border-t-0 md:border-l border-white/10 z-10">

        <div className="space-y-8">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="h-[1px] w-8 bg-pink-600" />
              <span className="text-pink-500 uppercase tracking-[0.3em] text-[10px] font-bold">{UI_STRINGS.chefChoice[lang]}</span>
              {item.isBestSeller && (
                <span className="bg-pink-600 text-white text-[9px] px-2 py-0.5 font-black uppercase tracking-[0.2em] rounded-sm ml-2">BEST SELLER</span>
              )}
            </div>
            <h1 className="text-5xl md:text-6xl lg:text-7xl text-white font-serif leading-none tracking-tight">{item.name[lang]}</h1>
          </div>

          <p className="text-white/60 text-lg leading-relaxed max-w-md font-light italic">
            "{item.description[lang]}"
          </p>

          <div className="grid grid-cols-2 gap-8">
            <div className="space-y-3">
              <h4 className="text-white/30 uppercase tracking-[0.2em] text-[9px] font-bold">{lang === 'fr' ? 'Ingrédients Clés' : 'Key Ingredients'}</h4>
              <div className="flex flex-wrap gap-1.5">
                {item.ingredients.map((ing, i) => (
                  <span key={i} className="px-2 py-0.5 bg-pink-950/30 border border-pink-900/30 rounded text-[10px] text-pink-200">
                    {ing[lang]}
                  </span>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="text-white/30 uppercase tracking-[0.2em] text-[9px] font-bold">{lang === 'fr' ? 'Allergènes' : 'Allergens'}</h4>
              <AllergenIcons allergens={item.allergens} />
            </div>
          </div>

          <div className="pt-10 flex flex-col sm:flex-row items-center gap-8">
            <div className="flex flex-col flex-1">
              <span className="text-white/20 text-[10px] uppercase font-bold tracking-[0.3em] mb-2">{UI_STRINGS.priceLabel[lang]}</span>
              <span className="text-4xl text-white font-serif">${item.price}</span>
            </div>

            <div className="flex items-center gap-4 w-full sm:w-auto">
              <QuantityStepper value={qty} onChange={setQty} className="!bg-white/5 !border-white/10" />
              <button
                onClick={handleAdd}
                className="flex-1 sm:flex-none px-10 py-4 bg-pink-600 text-white font-bold rounded-xl hover:bg-pink-500 transition-all hover:scale-105 active:scale-95 shadow-2xl shadow-pink-900/20 uppercase tracking-widest text-xs"
              >
                {UI_STRINGS.addBtn[lang]}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
