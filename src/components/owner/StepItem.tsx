import React from 'react';

interface StepItemProps {
  number: number;
  title: string;
  description?: string;
}

export const StepItem: React.FC<StepItemProps> = ({ number, title, description }) => {
  return (
    <div className="flex items-start gap-4">
      <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-primary to-accent rounded-xl flex items-center justify-center shadow-lg">
        <span className="text-white font-bold text-lg">{number}</span>
      </div>
      <div className="flex-1 pt-1">
        <h3 className="text-white font-semibold text-base mb-1">{title}</h3>
        {description && (
          <p className="text-white/60 text-sm leading-relaxed">{description}</p>
        )}
      </div>
    </div>
  );
};
