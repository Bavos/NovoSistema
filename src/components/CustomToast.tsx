import React from 'react';
import toast from 'react-hot-toast';
import { CheckCircle2, X } from 'lucide-react';

interface CustomToastProps {
  t: { id: string; visible: boolean };
  title?: string;
  message: string;
}

export const CustomSuccessToast: React.FC<CustomToastProps> = ({ t, title = 'Salvo com Sucesso!', message }) => {
  return (
    <div
      className={`${
        t.visible ? 'animate-in fade-in slide-in-from-top-3 duration-200' : 'animate-out fade-out slide-out-to-top-2 duration-150'
      } max-w-sm w-full bg-white border border-slate-200/90 shadow-lg rounded-xl pointer-events-auto p-3.5 flex items-start gap-3 ring-1 ring-slate-950/5`}
      id="custom-success-toast"
    >
      <div className="p-1.5 bg-emerald-100/90 text-emerald-600 rounded-lg flex-shrink-0 mt-0.5 shadow-xs">
        <CheckCircle2 size={18} className="stroke-[2.5]" />
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="text-xs font-bold text-slate-800 tracking-tight">{title}</h4>
        <p className="text-xs text-slate-600 leading-snug mt-0.5">{message}</p>
      </div>
      <button
        type="button"
        onClick={() => toast.dismiss(t.id)}
        className="text-slate-400 hover:text-slate-600 p-1 rounded-md transition-colors cursor-pointer flex-shrink-0"
        aria-label="Fechar"
      >
        <X size={14} />
      </button>
    </div>
  );
};

export const showSuccessToast = (message: string, title: string = 'Salvo com Sucesso!') => {
  toast.custom((t) => <CustomSuccessToast t={t} title={title} message={message} />, {
    duration: 4000,
  });
};
