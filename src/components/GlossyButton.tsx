import React from 'react';

interface GlossyButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'blue' | 'green' | 'red' | 'gray' | 'yellow';
}

export const GlossyButton: React.FC<GlossyButtonProps> = ({
  children,
  variant = 'blue',
  className = '',
  type = 'button',
  onClick,
  ...props
}) => {
  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (onClick) {
      onClick(e);
    }
  };

  return (
    <button
      type={type}
      className={`btn-glossy btn-${variant} relative z-20 flex-shrink-0 isolate pointer-events-auto ${className}`}
      onClick={handleClick}
      {...props}
    >
      {children}
    </button>
  );
};
