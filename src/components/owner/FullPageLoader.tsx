import React from 'react';

interface FullPageLoaderProps {
  message?: string;
  subtext?: string;
}

export const FullPageLoader: React.FC<FullPageLoaderProps> = ({
  message = 'Initializing application…',
  subtext = 'This should only take a few seconds',
}) => {
  return (
    <div className="min-h-screen w-full bg-white flex flex-col items-center justify-center text-center px-4">
      <div className="w-16 h-16 border-4 border-[#f97316] border-t-transparent rounded-full animate-spin mb-6" />
      <p className="text-lg font-semibold text-gray-900">{message}</p>
      {subtext ? <p className="text-sm text-gray-500 mt-2">{subtext}</p> : null}
    </div>
  );
};
