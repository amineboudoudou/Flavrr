
import React from 'react';
import { REVIEWS, UI_STRINGS } from '../constants';
import { Language } from '../types';

export const ReviewsView: React.FC<{ lang: Language }> = ({ lang }) => {
  const extendedReviews = [...REVIEWS, ...REVIEWS, ...REVIEWS, ...REVIEWS];

  return (
    <div className="w-full py-16 space-y-16 overflow-hidden">
      <div className="max-w-[1400px] mx-auto px-6 flex flex-col md:flex-row md:items-end justify-between gap-8">
        <div className="space-y-4">
          <h2 className="text-pink-500 uppercase tracking-widest text-xs font-bold">{lang === 'fr' ? 'Ils ont goûté. Ils valident.' : 'They tasted. They loved.'}</h2>
          <h1 className="text-5xl md:text-7xl font-serif text-white">{UI_STRINGS.reviewTitle[lang]}</h1>
          <p className="text-white/40 max-w-md">{UI_STRINGS.reviewSub[lang]}</p>
        </div>
      </div>
      <div className="relative w-full">
        <div className="absolute inset-y-0 left-0 w-32 bg-gradient-to-r from-black to-transparent z-10 pointer-events-none" />
        <div className="absolute inset-y-0 right-0 w-32 bg-gradient-to-l from-black to-transparent z-10 pointer-events-none" />
        <div className="flex gap-8 animate-scroll w-max px-8">
          {extendedReviews.map((review, idx) => (
            <div key={`${review.id}-${idx}`} className="w-[350px] md:w-[450px] bg-neutral-900 border border-white/5 p-8 rounded-[2rem] space-y-6 flex flex-col justify-between hover:border-pink-500/30 transition-colors group backdrop-blur-sm">
              <div className="space-y-4">
                  <div className="flex gap-1">{[...Array(5)].map((_, i) => (<span key={i} className={i < review.rating ? 'text-pink-500' : 'text-white/10'}>★</span>))}</div>
                  <p className="text-lg text-white/80 font-serif leading-relaxed italic whitespace-normal">"{review.comment[lang]}"</p>
              </div>
              <div className="flex items-center gap-4 pt-4 border-t border-white/5">
                  <img src={review.avatar} alt={review.author} className="w-10 h-10 rounded-full ring-2 ring-white/10" />
                  <div>
                      <h4 className="text-white text-sm font-medium">{review.author}</h4>
                      <p className="text-[10px] text-white/30 uppercase tracking-widest">{lang === 'fr' ? 'Client Vérifié' : 'Verified Customer'}</p>
                  </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
