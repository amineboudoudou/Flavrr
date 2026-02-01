
import React from 'react';
import { Plus, Minus } from './Icons';

interface Props {
  value: number;
  onChange: (val: number) => void;
  className?: string;
}

export const QuantityStepper: React.FC<Props> = ({ value, onChange, className = "" }) => {
  return (
    <div className={`flex items-center gap-4 bg-white/10 rounded-full px-4 py-2 border border-white/20 ${className}`}>
      <button 
        onClick={() => onChange(Math.max(1, value - 1))}
        className="text-white hover:text-pink-500 transition-colors"
      >
        <Minus />
      </button>
      <span className="text-white font-medium w-6 text-center">{value}</span>
      <button 
        onClick={() => onChange(value + 1)}
        className="text-white hover:text-pink-500 transition-colors"
      >
        <Plus />
      </button>
    </div>
  );
};
