
import React, { useEffect } from 'react';

interface Props {
  message: string;
  onClose: () => void;
}

export const Toast: React.FC<Props> = ({ message, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className="fixed bottom-28 sm:bottom-32 left-1/2 -translate-x-1/2 z-[200] bg-white text-black px-5 py-2.5 rounded-full font-medium shadow-2xl flex items-center gap-3 animate-bounce-in">
      <div className="w-2 h-2 rounded-full bg-pink-500" />
      {message}
      <style>{`
        @keyframes bounce-in {
          0% { transform: translate(-50%, 100px); opacity: 0; }
          60% { transform: translate(-50%, -10px); opacity: 1; }
          100% { transform: translate(-50%, 0); opacity: 1; }
        }
        .animate-bounce-in {
          animation: bounce-in 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }
      `}</style>
    </div>
  );
};
