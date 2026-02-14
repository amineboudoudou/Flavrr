import React from 'react';

interface StepItemProps {
  number: number;
  title: string;
  description?: string;
}

export const StepItem: React.FC<StepItemProps> = ({ number, title, description }) => {
  return (
    <div className="flex items-start gap-4">
      <div className="flex-shrink-0 w-8 h-8 bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg flex items-center justify-center shadow-sm">
        <span className="text-white font-bold text-sm">{number}</span>
      </div>
      <div className="flex-1">
        <h3 className="text-slate-900 font-semibold text-sm tracking-tight mb-1">{title}</h3>
        {description && (
          <p className="text-slate-500 text-sm leading-relaxed">{description}</p>
        )}
      </div>
    </div>
  );
};
