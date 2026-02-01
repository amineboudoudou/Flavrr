
import React from 'react';
import { MenuItem, Language } from '../types';

interface Props {
    lang: Language;
    items: MenuItem[];
    onItemClick: (item: MenuItem) => void;
}

export const DishGallery: React.FC<Props> = ({ lang, items, onItemClick }) => {
    // Triple the items to ensure continuous scrolling
    const scrollingItems = [...items, ...items, ...items];

    return (
        <section className="py-24 bg-black overflow-hidden relative">
            <div className="max-w-[1400px] mx-auto px-6 mb-12">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                    <div className="space-y-4">
                        <h4 className="text-pink-500 uppercase tracking-[0.4em] text-[10px] font-black">L'Art Culinaire</h4>
                        <h2 className="text-4xl md:text-6xl font-serif text-white">Inspirations du Jour</h2>
                    </div>
                    <p className="text-white/40 max-w-sm italic">
                        {lang === 'fr'
                            ? "Laissez-vous tenter par nos créations visuelles avant de succomber au goût."
                            : "Let yourself be tempted by our visual creations before succumbing to the taste."}
                    </p>
                </div>
            </div>

            <div className="relative flex group">
                {/* Gradients to fade edges */}
                <div className="absolute inset-y-0 left-0 w-32 bg-gradient-to-r from-black to-transparent z-10 pointer-events-none" />
                <div className="absolute inset-y-0 right-0 w-32 bg-gradient-to-l from-black to-transparent z-10 pointer-events-none" />

                <div className="flex animate-marquee group-hover:pause-marquee gap-6 px-6">
                    {scrollingItems.map((item, idx) => {
                        const imageUrl = item.image.startsWith('/')
                            ? `https://images.unsplash.com/photo-1544124499-58912cbddaad?auto=format&fit=crop&q=80&w=600`
                            : item.image;

                        return (
                            <div
                                key={`${item.id}-${idx}`}
                                onClick={() => onItemClick(item)}
                                className="relative flex-shrink-0 w-72 h-[450px] rounded-[2rem] overflow-hidden cursor-pointer border border-white/5 transition-all duration-500 hover:scale-[1.02] hover:border-pink-500/30 group/card"
                            >
                                <img
                                    src={imageUrl}
                                    alt={item.name[lang]}
                                    className="w-full h-full object-cover grayscale-[0.2] group-hover/card:grayscale-0 transition-all duration-700"
                                />

                                {/* Overlay */}
                                <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-60 group-hover/card:opacity-90 transition-opacity duration-500" />

                                {/* Content */}
                                <div className="absolute inset-0 p-8 flex flex-col justify-end translate-y-4 group-hover/card:translate-y-0 transition-transform duration-500">
                                    <span className="text-pink-500 text-[9px] font-black tracking-[0.3em] uppercase mb-2 opacity-0 group-hover/card:opacity-100 transition-opacity">Commandez</span>
                                    <h3 className="text-xl text-white font-serif leading-none mb-1">{item.name[lang]}</h3>
                                    <p className="text-pink-500 font-bold">${item.price}</p>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            <style>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-33.33%); }
        }
        .animate-marquee {
          animation: marquee 40s linear infinite;
        }
        .pause-marquee {
          animation-play-state: paused;
        }
      `}</style>
        </section>
    );
};
