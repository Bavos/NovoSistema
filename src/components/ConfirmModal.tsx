/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle, ShieldAlert, X } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  description: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  expectedWord?: string; // Defaults to 'CONFIRMAR'
  severity?: 'danger' | 'warning';
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = 'Continuar',
  cancelText = 'Cancelar',
  expectedWord = 'CONFIRMAR',
  severity = 'danger',
}) => {
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setInputText('');
      setLoading(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const isMatched = inputText.trim() === expectedWord;

  const handleConfirmClick = async () => {
    if (!isMatched || loading) return;
    setLoading(true);
    try {
      await onConfirm();
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const severityColors = {
    danger: {
      accent: 'border-red-200 bg-red-50 text-red-700',
      button: 'bg-red-600 hover:bg-red-700 hover:shadow-red-200/50 text-white focus:ring-red-500',
      glow: 'shadow-red-50',
    },
    warning: {
      accent: 'border-amber-200 bg-amber-50 text-amber-700',
      button: 'bg-amber-600 hover:bg-amber-700 hover:shadow-amber-200/50 text-white focus:ring-amber-500',
      glow: 'shadow-amber-50',
    },
  };

  const colors = severityColors[severity];

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
        {/* Backdrop overlay */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-md"
        />

        {/* Modal content container */}
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 10 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 10 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className={`relative bg-white w-full max-w-md rounded-2xl border border-slate-200 shadow-2xl p-6 md:p-7 space-y-4 font-sans text-left z-10 ${colors.glow}`}
        >
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-1.5 rounded-full transition-all cursor-pointer"
          >
            <X size={16} />
          </button>

          {/* Icon and Title Header */}
          <div className="flex items-start space-x-3.5">
            <div className={`p-2.5 rounded-xl border ${colors.accent}`}>
              {severity === 'danger' ? <ShieldAlert size={22} /> : <AlertTriangle size={22} />}
            </div>
            <div className="flex-1 min-w-0 pr-6">
              <h3 className="text-base font-bold text-slate-900 leading-snug">
                {title}
              </h3>
              <div className="text-xs text-slate-500 mt-1.5 leading-relaxed font-sans">
                {description}
              </div>
            </div>
          </div>

          {/* Validation warning block */}
          <div className="bg-slate-50 border border-slate-150 rounded-xl p-3.5 space-y-2.5">
            <label className="block text-xs font-semibold text-slate-700">
              Esta é uma ação protegida e irreversível. Para autorizar, digite <span className="font-extrabold text-red-600 select-all font-mono">'{expectedWord}'</span> abaixo:
            </label>
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={`Digite ${expectedWord}`}
              disabled={loading}
              className="w-full text-xs font-mono font-bold tracking-widest px-3 py-2.5 border border-slate-200 rounded-lg text-slate-800 bg-white placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:opacity-50 transition-all uppercase"
            />
          </div>

          {/* Actions Footer */}
          <div className="flex gap-3 pt-1">
            <button
              onClick={onClose}
              disabled={loading}
              className="flex-1 py-2 px-4 text-xs font-semibold text-slate-600 hover:text-slate-800 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition-all cursor-pointer disabled:opacity-50"
            >
              {cancelText}
            </button>
            <button
              onClick={handleConfirmClick}
              disabled={!isMatched || loading}
              className={`flex-1 py-2 px-4 text-xs font-bold rounded-xl transition-all shadow-md flex items-center justify-center space-x-1.5 disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none ${colors.button}`}
            >
              <span>{loading ? 'Processando...' : confirmText}</span>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
