
import React from 'react';
import { NEWS, UI_STRINGS } from '../constants';
import { Language } from '../types';

export const NewsView: React.FC<{ lang: Language }> = ({ lang }) => {
  return (
    <div className="h-full w-full bg-black flex flex-col items-center p-6 pt-24 pb-12 overflow-y-auto">
      <div className="max-w-4xl w-full space-y-12">
        <div className="text-center space-y-2">
          <h2 className="text-pink-500 uppercase tracking-widest text-xs font-bold">{UI_STRINGS.newsJournal[lang]}</h2>
          <h1 className="text-6xl font-serif text-white">{UI_STRINGS.newsTitle[lang]}</h1>
        </div>
        <div className="space-y-16">
          {NEWS.map((post) => (
            <article key={post.id} className="group cursor-pointer">
              <div className="relative aspect-[21/9] overflow-hidden rounded-3xl mb-8">
                <img src={post.image} alt={post.title[lang]} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                <div className="absolute top-6 left-6 bg-black/60 backdrop-blur-md px-4 py-1 rounded-full text-[10px] text-pink-500 font-bold tracking-widest uppercase">{post.date[lang]}</div>
              </div>
              <div className="space-y-4 max-w-2xl">
                <h2 className="text-3xl md:text-4xl text-white font-serif group-hover:text-pink-500 transition-colors">{post.title[lang]}</h2>
                <p className="text-white/60 leading-relaxed text-lg">{post.excerpt[lang]}</p>
                <button className="text-pink-500 font-bold uppercase tracking-widest text-xs flex items-center gap-2 group-hover:gap-4 transition-all">{UI_STRINGS.newsReadMore[lang]} <span>→</span></button>
              </div>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
};
