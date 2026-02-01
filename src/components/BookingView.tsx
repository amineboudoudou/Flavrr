
import React, { useState } from 'react';
import { Language } from '../types';
import { UI_STRINGS } from '../constants';

export const BookingView: React.FC<{ lang: Language }> = ({ lang }) => {
  const [selectedDate, setSelectedDate] = useState<number | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const days = Array.from({ length: 31 }, (_, i) => i + 1);
  const slots = ['18:00', '18:30', '19:00', '19:30', '20:00', '20:30', '21:00'];

  return (
    <div className="h-full w-full bg-black flex flex-col items-center justify-center p-6 pb-24 overflow-y-auto">
      <div className="max-w-2xl w-full space-y-12">
        <div className="text-center space-y-4">
          <h1 className="text-5xl md:text-6xl font-serif text-white">{UI_STRINGS.bookingTitle[lang]}</h1>
          <p className="text-white/40 tracking-widest uppercase text-sm">{UI_STRINGS.bookingSub[lang]}</p>
        </div>
        <div className="grid md:grid-cols-2 gap-12">
          <div className="space-y-6">
            <h3 className="text-white text-lg font-serif">{lang === 'fr' ? 'Décembre 2024' : 'December 2024'}</h3>
            <div className="grid grid-cols-7 gap-2">
              {(lang === 'fr' ? ['D', 'L', 'M', 'M', 'J', 'V', 'S'] : ['S', 'M', 'T', 'W', 'T', 'F', 'S']).map((d, i) => (
                <div key={`${d}-${i}`} className="text-[10px] text-white/40 text-center font-bold">{d}</div>
              ))}
              {days.map(d => (
                <button key={d} onClick={() => setSelectedDate(d)} className={`aspect-square flex items-center justify-center text-sm rounded-full transition-all border ${selectedDate === d ? 'bg-pink-600 text-white border-pink-600 scale-110 shadow-lg' : 'text-white/60 border-transparent hover:border-white/20'}`}>{d}</button>
              ))}
            </div>
          </div>
          <div className="space-y-8">
            <div className="space-y-4">
              <h3 className="text-white text-lg font-serif">{UI_STRINGS.bookingTime[lang]}</h3>
              <div className="grid grid-cols-3 gap-3">
                {slots.map(s => (
                  <button key={s} onClick={() => setSelectedTime(s)} className={`py-3 rounded-lg text-xs font-bold transition-all border ${selectedTime === s ? 'bg-white text-black border-white' : 'bg-white/5 text-white/60 border-white/10 hover:bg-white/10'}`}>{s}</button>
                ))}
              </div>
            </div>
            <div className="space-y-4">
              <h3 className="text-white text-lg font-serif">{UI_STRINGS.bookingGuests[lang]}</h3>
              <select className="w-full bg-white/5 border border-white/10 text-white p-4 rounded-xl outline-none focus:border-pink-500 transition-colors">
                <option>{lang === 'fr' ? '2 Personnes' : '2 Guests'}</option>
                <option>{lang === 'fr' ? '4 Personnes' : '4 Guests'}</option>
                <option>{lang === 'fr' ? '6 Personnes' : '6 Guests'}</option>
                <option>{lang === 'fr' ? 'Groupe' : 'Group'}</option>
              </select>
            </div>
          </div>
        </div>
        <button disabled={!selectedDate || !selectedTime} className="w-full py-5 bg-pink-600 text-white font-bold uppercase tracking-[0.2em] rounded-full hover:bg-pink-500 transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-xl shadow-pink-900/10">{UI_STRINGS.bookingConfirm[lang]}</button>
      </div>
    </div>
  );
};
