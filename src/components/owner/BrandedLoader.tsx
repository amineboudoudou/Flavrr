import React from 'react';
import { LogoIcon } from '../Icons';

type BrandedLoaderProps = {
  message?: string;
  size?: 'sm' | 'md' | 'lg';
  fullPage?: boolean;
};

export const BrandedLoader: React.FC<BrandedLoaderProps> = ({
  message = 'Loading your dashboard…',
  size = 'md',
  fullPage = false,
}) => {
  const ringClass =
    size === 'sm'
      ? 'w-5 h-5 border-2'
      : size === 'lg'
        ? 'w-12 h-12 border-4'
        : 'w-9 h-9 border-4';

  const content = (
    <div className="flex flex-col items-center justify-center text-center">
      <div className="w-11 h-11 rounded-2xl bg-surface-2 border border-border flex items-center justify-center shadow-[var(--shadow)] mb-4">
        <LogoIcon className="w-6 h-6 text-primary" />
      </div>
      <div className={`${ringClass} border-primary border-t-transparent rounded-full animate-spin`} />
      {message ? (
        <p className="mt-4 text-sm text-muted">{message}</p>
      ) : null}
    </div>
  );

  if (!fullPage) return content;

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-64px)] px-6">
      {content}
    </div>
  );
};
