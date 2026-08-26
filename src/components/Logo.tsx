import React from 'react';

interface LogoProps {
  className?: string;
  style?: React.CSSProperties;
}

export const Logo: React.FC<LogoProps> = ({ className = 'w-full h-auto', style }) => {
  return (
    <svg
      viewBox="0 0 500 360"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={style}
      id="svg-logo-branding"
    >
      <defs>
        {/* Metallic Gold Gradient */}
        <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#8A6623" />
          <stop offset="20%" stopColor="#C5A059" />
          <stop offset="40%" stopColor="#F5E3B5" />
          <stop offset="60%" stopColor="#D8B26B" />
          <stop offset="80%" stopColor="#9E7831" />
          <stop offset="100%" stopColor="#70521A" />
        </linearGradient>

        {/* Forest Green Gradient */}
        <linearGradient id="greenGrad" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#0B2314" />
          <stop offset="50%" stopColor="#1B4D2E" />
          <stop offset="100%" stopColor="#0F331D" />
        </linearGradient>

        {/* Secondary Delicate Gold Gradient */}
        <linearGradient id="goldLight" x1="100%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#F5E3B5" />
          <stop offset="50%" stopColor="#C5A059" />
          <stop offset="100%" stopColor="#8A6623" />
        </linearGradient>
      </defs>

      {/* 1. Upper Gold Arcs */}
      <path
        d="M 65,120 C 180,50 320,50 435,120"
        fill="none"
        stroke="url(#goldGrad)"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <path
        d="M 85,103 C 190,40 310,40 415,103"
        fill="none"
        stroke="url(#goldGrad)"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.85"
      />

      {/* 2. Lower Gold Arcs */}
      <path
        d="M 65,265 C 180,335 320,335 435,265"
        fill="none"
        stroke="url(#goldGrad)"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <path
        d="M 85,282 C 190,345 310,345 415,282"
        fill="none"
        stroke="url(#goldGrad)"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.85"
      />

      {/* 3. Left Side: Intertwined Gold Heart and Green Leaf */}
      <g transform="translate(5, 5)">
        {/* Soft Gold Heart Inner Glow/Fill */}
        <path
          d="M 145,225 C 117,201 80,168 80,135 C 80,107 103,88 131,107 C 140,113 145,121 145,121 C 145,121 150,113 159,107 C 187,88 210,107 210,135 C 210,154 196,173 177,191"
          fill="url(#goldGrad)"
          fillOpacity="0.12"
        />

        {/* Double-Line Metallic Gold Heart Outline */}
        <path
          d="M 145,225 C 117,201 80,168 80,135 C 80,107 103,88 131,107 C 140,113 145,121 145,121 C 145,121 150,113 159,107 C 187,88 210,107 210,135 C 210,154 196,173 177,191"
          fill="none"
          stroke="url(#goldGrad)"
          strokeWidth="4.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M 145,217 C 122,197 88,167 88,135 C 88,113 107,96 131,113 C 137,117 141,123 145,128 C 149,123 153,117 159,113 C 183,96 202,113 202,135 C 202,151 189,169 173,184"
          fill="none"
          stroke="url(#goldLight)"
          strokeWidth="1.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.9"
        />

        {/* Beautiful Green Leaf Intertwining with the Gold Heart */}
        <path
          d="M 103,205 C 112,158 158,118 193,123 C 184,163 142,198 103,205 Z"
          fill="url(#greenGrad)"
          stroke="url(#goldGrad)"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />

        {/* Leaf Gold Details (Central Vein and Delicate Lateral Ribs) */}
        <path
          d="M 103,205 Q 150,165 193,123"
          fill="none"
          stroke="url(#goldLight)"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
        <path
          d="M 128,185 Q 138,175 148,175"
          fill="none"
          stroke="url(#goldLight)"
          strokeWidth="1.2"
          strokeLinecap="round"
        />
        <path
          d="M 153,165 Q 168,155 178,155"
          fill="none"
          stroke="url(#goldLight)"
          strokeWidth="1.2"
          strokeLinecap="round"
        />
        <path
          d="M 115,190 Q 122,198 128,203"
          fill="none"
          stroke="url(#goldLight)"
          strokeWidth="1.2"
          strokeLinecap="round"
        />
        <path
          d="M 140,170 Q 148,178 155,183"
          fill="none"
          stroke="url(#goldLight)"
          strokeWidth="1.2"
          strokeLinecap="round"
        />
      </g>

      {/* 4. Right Side: Classic Serif 'RH' and 'Gestão Domiciliar' */}
      <g>
        {/* Large Serif 'R H' letters in Elegant Forest Green */}
        <text
          x="226"
          y="204"
          fontFamily="Times New Roman, Georgia, Playfair Display, serif"
          fontSize="102"
          fontWeight="700"
          fill="#133820"
          letterSpacing="-1.5"
        >
          RH
        </text>

        {/* 'Gestão Domiciliar' text in highly readable balanced serif */}
        <text
          x="196"
          y="242"
          fontFamily="Times New Roman, Georgia, Playfair Display, serif"
          fontSize="22.5"
          fontWeight="bold"
          fill="#133820"
          letterSpacing="0.4"
        >
          Gestão Domiciliar
        </text>
      </g>
    </svg>
  );
};
