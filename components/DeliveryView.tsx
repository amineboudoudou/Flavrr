
import React from 'react';
import { Truck, ShoppingCart, Utensils } from './Icons';
import { Language } from '../types';
import { UI_STRINGS } from '../constants';

export const DeliveryView: React.FC<{ lang: Language }> = ({ lang }) => {
  const steps = [
    {
      id: '01',
      title: lang === 'fr' ? 'Tu commandes' : 'You Order',
      description: lang === 'fr' ? 'Fais-toi plaisir avec nos classiques haïtiens.' : 'Treat yourself to our Haitian classics.',
      icon: <ShoppingCart className="w-8 h-8" />,
      tag: lang === 'fr' ? 'LE CHOIX' : 'THE CHOICE'
    },
    {
      id: '02',
      title: lang === 'fr' ? "On s'occupe de tout" : "We Handle Everything",
      description: lang === 'fr' ? "C'est frit et emballé avec amour." : "It's fried and packed with love.",
      icon: <Truck className="w-8 h-8" />,
      tag: lang === 'fr' ? 'LE VOYAGE' : 'THE JOURNEY'
    },
    {
      id: '03',
      title: lang === 'fr' ? 'Haïti, direct chez toi' : 'Haiti, Directly to You',
      description: lang === 'fr' ? 'Reçois ton festin chaud.' : 'Receive your hot feast.',
      icon: <Utensils className="w-8 h-8" />,
      tag: lang === 'fr' ? 'LE RÉGAL' : 'THE TREAT'
    }
  ];

  return (
    <div className="w-full max-w-6xl mx-auto px-6 py-24 space-y-24">
      <div className="text-center space-y-4">
        <h2 className="text-pink-500 uppercase tracking-[0.3em] text-xs font-bold">{lang === 'fr' ? 'Haiti à ta porte' : 'Haiti at your door'}</h2>
        <h1 className="text-6xl md:text-8xl font-serif text-white">{UI_STRINGS.deliveryTitle[lang]}</h1>
        <p className="text-white/40 max-w-2xl mx-auto text-lg leading-relaxed">
          {UI_STRINGS.deliverySub[lang]}
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-8 relative">
        <div className="hidden md:block absolute top-1/2 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-pink-500/30 to-transparent -z-0" />
        {steps.map((step) => (
          <div key={step.id} className="relative group bg-neutral-900/30 border border-white/5 p-10 rounded-[3rem] backdrop-blur-xl hover:bg-pink-950/20 transition-all duration-500 hover:-translate-y-2 flex flex-col items-center text-center space-y-8">
            <div className="absolute -top-6 left-1/2 -translate-x-1/2 w-12 h-12 bg-pink-600 rounded-full flex items-center justify-center text-white font-bold shadow-xl shadow-pink-900/40 group-hover:scale-110 transition-transform">
              {step.id}
            </div>
            <div className="w-20 h-20 rounded-2xl bg-white/5 flex items-center justify-center text-pink-500 group-hover:text-white group-hover:bg-pink-600 transition-all duration-500">
              {step.icon}
            </div>
            <div className="space-y-4">
              <span className="text-[10px] text-pink-500 font-bold tracking-[0.2em] uppercase">{step.tag}</span>
              <h3 className="text-3xl text-white font-serif">{step.title}</h3>
              <p className="text-white/40 leading-relaxed text-sm">{step.description}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
