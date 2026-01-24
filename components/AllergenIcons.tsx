
import React from 'react';
import { Allergen } from '../types';

interface Props {
  allergens: Allergen[];
}

const ALLERGEN_MAP: Record<Allergen, string> = {
  Gluten: '🌾',
  Dairy: '🥛',
  Nuts: '🥜',
  Vegan: '🌱',
  Spicy: '🌶️',
  Shellfish: '🦐'
};

export const AllergenIcons: React.FC<Props> = ({ allergens }) => {
  return (
    <div className="flex gap-2">
      {allergens.map((allergen) => (
        <div 
          key={allergen} 
          title={allergen}
          className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-sm border border-white/20"
        >
          {ALLERGEN_MAP[allergen]}
        </div>
      ))}
    </div>
  );
};
