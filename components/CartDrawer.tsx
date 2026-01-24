
import React from 'react';
import { CartItem, Language } from '../types';
import { X, Trash, Plus, Minus } from './Icons';
import { UI_STRINGS } from '../constants';

interface Props {
  lang: Language;
  isOpen: boolean;
  onClose: () => void;
  items: CartItem[];
  onUpdateQuantity: (id: string, delta: number) => void;
  onRemove: (id: string) => void;
  onCheckout: () => void;
}

export const CartDrawer: React.FC<Props> = ({ lang, isOpen, onClose, items, onUpdateQuantity, onRemove, onCheckout }) => {
  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex justify-end">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full md:w-[450px] bg-neutral-900 h-full shadow-2xl flex flex-col animate-slide-in-right">
        <div className="p-6 border-b border-white/10 flex items-center justify-between">
          <h2 className="text-2xl font-serif text-white">{UI_STRINGS.cartTitle[lang]}</h2>
          <button onClick={onClose} className="p-2 text-white/50 hover:text-white">
            <X />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {items.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-white/30 space-y-4">
              <div className="w-16 h-16 border-2 border-dashed border-white/20 rounded-full flex items-center justify-center">
                <Trash className="w-8 h-8" />
              </div>
              <p className="text-lg">{UI_STRINGS.cartEmpty[lang]}</p>
            </div>
          ) : (
            items.map((item) => (
              <div key={item.id} className="flex gap-4 group">
                <div className="w-20 h-20 rounded-lg overflow-hidden flex-shrink-0">
                  <img src={item.image} alt={item.name[lang]} className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 space-y-1">
                  <div className="flex justify-between">
                    <h3 className="font-medium text-white">{item.name[lang]}</h3>
                    <span className="text-pink-500 font-medium">${item.price * item.quantity}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center bg-white/5 rounded-md px-2 py-1 gap-3">
                      <button onClick={() => onUpdateQuantity(item.id, -1)} className="text-white/60 hover:text-white"><Minus className="w-3 h-3" /></button>
                      <span className="text-xs text-white">{item.quantity}</span>
                      <button onClick={() => onUpdateQuantity(item.id, 1)} className="text-white/60 hover:text-white"><Plus className="w-3 h-3" /></button>
                    </div>
                    <button onClick={() => onRemove(item.id)} className="text-red-400 opacity-0 group-hover:opacity-100 transition-opacity p-2"><Trash className="w-4 h-4" /></button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {items.length > 0 && (
          <div className="p-8 border-t border-white/10 bg-black/30">
            <div className="flex justify-between items-center mb-6">
              <span className="text-white/50 uppercase tracking-widest text-sm">{UI_STRINGS.cartTotal[lang]}</span>
              <span className="text-3xl font-serif text-white">${total}</span>
            </div>
            <button
              onClick={onCheckout}
              className="w-full py-4 bg-pink-600 text-white font-bold uppercase tracking-widest rounded-lg hover:bg-pink-500 transition-all shadow-xl shadow-pink-900/10"
            >
              {UI_STRINGS.cartCheckout[lang]}
            </button>
          </div>
        )}
      </div>

      <style>{`
        @keyframes slide-in-right {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        .animate-slide-in-right {
          animation: slide-in-right 0.3s ease-out;
        }
      `}</style>
    </div>
  );
};
