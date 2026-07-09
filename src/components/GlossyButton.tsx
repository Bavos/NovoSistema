import React from 'react';

interface GlossyButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'blue' | 'green' | 'red' | 'gray' | 'yellow';
}

export const GlossyButton: React.FC<GlossyButtonProps> = ({
  children,
  variant = 'blue',
  className = '',
  type = 'button',
  ...props
}) => {
  return (
    <button
      type={type}
      className={`btn-glossy btn-${variant} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};
