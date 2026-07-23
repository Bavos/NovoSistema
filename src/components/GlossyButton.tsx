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
    let label = props.id || props['aria-label'] || '';
    if (!label) {
      if (typeof children === 'string') {
        label = children;
      } else if (Array.isArray(children)) {
        label = children.map(c => typeof c === 'string' ? c : '').join(' ').trim() || 'Botão';
      } else {
        label = 'Botão';
      }
    }

    if (onClick) {
      alert(`Ação disparada no botão: ${label}`);
      onClick(e);
    } else {
      alert(`⚠️ Atenção: O botão ${label} está sem função configurada!`);
    }
  };

  return (
    <button
      type={type}
      className={`btn-glossy btn-${variant} ${className}`}
      onClick={handleClick}
      {...props}
    >
      {children}
    </button>
  );
};
