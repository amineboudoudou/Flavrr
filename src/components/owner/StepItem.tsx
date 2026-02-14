import React from 'react';

interface StepItemProps {
  number: number;
  title: string;
  description?: string;
}

export const StepItem: React.FC<StepItemProps> = ({ number, title, description }) => {
  return (
    <div className="flex items-start gap-4">
      <div className="flex-shrink-0 w-8 h-8 bg-gradient-to-br from-primary to-accent rounded-lg flex items-center justify-center">
        <span className="text-white font-bold text-sm">{number}</span>
      </div>
      <div className="flex-1">
        <h3 className="text-white font-semibold text-sm mb-1">{title}</h3>
        {description && (
          <p className="text-white/50 text-sm leading-relaxed">{description}</p>
        )}
      </div>
    </div>
  );
};
