import React from 'react';

// CardBase: Um componente contêiner padrão
interface CardBaseProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export const CardBase: React.FC<CardBaseProps> = ({ children, className = '', ...props }) => {
  return (
    <div 
      className={`bg-white border border-gray-100 shadow-sm rounded-xl p-6 ${className}`} 
      {...props}
    >
      {children}
    </div>
  );
};

// DataGrid: Wrapper para os campos de dados lado a lado
interface DataGridProps extends React.HTMLAttributes<HTMLDivElement> {
  cols?: 1 | 2 | 3 | 4 | 5 | 6;
  children: React.ReactNode;
}

export const DataGrid: React.FC<DataGridProps> = ({ cols = 4, children, className = '', ...props }) => {
  const colClass = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 md:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3',
    4: 'grid-cols-1 sm:grid-cols-2 md:grid-cols-4',
    5: 'grid-cols-1 sm:grid-cols-3 md:grid-cols-5',
    6: 'grid-cols-1 sm:grid-cols-3 md:grid-cols-6',
  }[cols] || 'grid-cols-1 md:grid-cols-4';

  return (
    <div className={`grid ${colClass} gap-4 ${className}`} {...props}>
      {children}
    </div>
  );
};

// DataField: Exibe dados individuais
interface DataFieldProps extends React.HTMLAttributes<HTMLDivElement> {
  label: string;
  value: React.ReactNode;
}

export const DataField: React.FC<DataFieldProps> = ({ label, value, className = '', ...props }) => {
  return (
    <div className={`flex flex-col min-w-0 ${className}`} {...props}>
      <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider block">
        {label}
      </span>
      <span className="text-sm font-medium text-gray-900 mt-0.5 block truncate" title={typeof value === 'string' ? value : undefined}>
        {value || <span className="text-gray-300 italic">Preencher</span>}
      </span>
    </div>
  );
};

// SoftBadge: Status e tags com cores muito suaves, sem bordas
interface SoftBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  children: React.ReactNode;
  variant?: 'blue' | 'green' | 'red' | 'yellow' | 'gray' | 'purple' | 'indigo' | 'emerald' | 'amber' | 'rose' | 'slate';
}

export const SoftBadge: React.FC<SoftBadgeProps> = ({ children, variant = 'gray', className = '', ...props }) => {
  const styles = {
    blue: 'bg-blue-50 text-blue-800',
    green: 'bg-emerald-50 text-emerald-800',
    emerald: 'bg-emerald-50 text-emerald-800',
    red: 'bg-rose-50 text-rose-800',
    rose: 'bg-rose-50 text-rose-800',
    yellow: 'bg-amber-50 text-amber-800',
    amber: 'bg-amber-50 text-amber-800',
    gray: 'bg-slate-50 text-slate-800',
    slate: 'bg-slate-50 text-slate-800',
    purple: 'bg-purple-50 text-purple-800',
    indigo: 'bg-indigo-50 text-indigo-800',
  }[variant] || 'bg-slate-50 text-slate-800';

  return (
    <span 
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium select-none leading-none ${styles} ${className}`} 
      {...props}
    >
      {children}
    </span>
  );
};
