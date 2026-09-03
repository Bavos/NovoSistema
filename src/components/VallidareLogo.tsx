import React from 'react';

interface VallidareLogoProps {
  className?: string;
  height?: number | string;
  style?: React.CSSProperties;
  showText?: boolean;
  id?: string;
}

export const VallidareIcon: React.FC<{ className?: string; style?: React.CSSProperties; id?: string }> = ({
  className = 'w-full h-full',
  style,
  id
}) => (
  <svg
    viewBox="0 0 120 90"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`object-contain shrink-0 ${className}`}
    style={{ imageRendering: '-webkit-optimize-contrast', ...style }}
    id={id || 'svg-vallidare-icon'}
  >
    <defs>
      <linearGradient id="valGrad1" x1="0%" y1="100%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#0284c7" />
        <stop offset="100%" stopColor="#38bdf8" />
      </linearGradient>
      <linearGradient id="valGrad2" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#38bdf8" />
        <stop offset="100%" stopColor="#67e8f9" />
      </linearGradient>
      <linearGradient id="valGrad3" x1="0%" y1="100%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#0f766e" />
        <stop offset="100%" stopColor="#14b8a6" />
      </linearGradient>
      <linearGradient id="valGrad4" x1="100%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#7dd3fc" />
        <stop offset="100%" stopColor="#bae6fd" />
      </linearGradient>
    </defs>

    {/* Facetas Geométricas / Asas Poligonais */}
    <polygon points="10,80 58,15 72,32 30,80" fill="url(#valGrad4)" opacity="0.9" />
    <polygon points="30,80 72,32 98,48 48,80" fill="url(#valGrad2)" />
    <polygon points="48,80 98,48 114,64 68,80" fill="url(#valGrad1)" />
    <polygon points="68,80 114,64 118,78 84,80" fill="url(#valGrad3)" />
  </svg>
);

export const VallidareLogo: React.FC<VallidareLogoProps> = ({
  className = '',
  height = 48,
  style,
  showText = true,
  id
}) => {
  return (
    <div
      className={`inline-flex items-center gap-3 ${className}`}
      style={{ ...(height !== undefined && height !== null ? { height } : {}), ...style }}
      id={id || 'vallidare-brand-logo'}
    >
      <VallidareIcon className="h-full w-auto max-h-full" />

      {showText && (
        <div className="flex flex-col justify-center select-none">
          <span 
            className="font-black text-[#1e293b] tracking-wider uppercase leading-none"
            style={{ fontFamily: 'Arial, Helvetica, sans-serif', fontSize: '20px', letterSpacing: '0.08em' }}
          >
            VALLIDARE
          </span>
          <span 
            className="font-semibold text-[#64748b] tracking-widest uppercase mt-1 leading-none"
            style={{ fontFamily: 'Arial, Helvetica, sans-serif', fontSize: '7.5px', letterSpacing: '0.15em' }}
          >
            GESTÃO E CONSULTORIA EM SAÚDE
          </span>
        </div>
      )}
    </div>
  );
};
