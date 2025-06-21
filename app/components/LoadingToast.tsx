import React, { useEffect, useState } from "react";

interface LoadingToastProps {
  message: string;
  isVisible: boolean;
  onComplete?: () => void;
}

export default function LoadingToast({ message, isVisible, onComplete }: LoadingToastProps) {
  const [shouldRender, setShouldRender] = useState(false);

  useEffect(() => {
    if (isVisible) {
      setShouldRender(true);
    } else {
      const timer = setTimeout(() => {
        setShouldRender(false);
      }, 500); // Tiempo de la animación de salida
      return () => clearTimeout(timer);
    }
  }, [isVisible]);

  useEffect(() => {
    if (isVisible && onComplete) {
      const timer = setTimeout(() => {
        onComplete();
      }, 3000); // 3 segundos de duración
      return () => clearTimeout(timer);
    }
  }, [isVisible, onComplete]);

  if (!shouldRender) return null;

  return (
    <div
      className={`fixed bottom-4 right-4 z-50 transform transition-all duration-500 ease-in-out ${
        isVisible
          ? "translate-y-0 opacity-100 scale-100"
          : "translate-y-2 opacity-0 scale-95"
      }`}
    >
      <div className="flex items-center space-x-3 rounded-lg bg-brand-primary px-4 py-3 shadow-lg">
        {/* Spinner de loading */}
        <div className="animate-spin rounded-full h-5 w-5 border-2 border-brand-title border-t-transparent"></div>
        
        {/* Mensaje */}
        <div className="text-brand-title font-medium">
          {message}
        </div>
      </div>
    </div>
  );
} 