import React, { ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCw, ArrowLeft } from 'lucide-react';

interface Props {
  children?: ReactNode;
  fallback?: ReactNode;
  onReset?: () => void;
  title?: string;
  className?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    // Atualiza o estado para que o próximo render mostre a UI de fallback alternativa
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[ErrorBoundary] Erro de renderização não capturado no prontuário/paciente:", error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  private handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className={`p-6 sm:p-10 max-w-2xl mx-auto my-8 bg-white rounded-3xl border border-red-100 shadow-xl space-y-6 text-center animate-in fade-in duration-300 ${this.props.className || ''}`}>
          <div className="w-16 h-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
            <AlertCircle className="w-8 h-8" />
          </div>
          
          <div className="space-y-2">
            <h2 className="text-xl font-extrabold text-slate-800 tracking-tight">
              {this.props.title || 'Falha no Carregamento do Prontuário'}
            </h2>
            <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
              Ocorreu um erro inesperado ao carregar ou processar as informações de visualização deste prontuário.
              Garantimos que o restante do sistema continue ativo para que você não perca seu fluxo de trabalho.
            </p>
          </div>

          {this.state.error && (
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-left font-mono text-[10px] text-red-600 overflow-x-auto max-h-36">
              <span className="font-bold uppercase text-[9px] text-slate-400 block mb-1">Logs do Erro</span>
              {this.state.error.toString()}
            </div>
          )}

          <div className="pt-2 flex flex-col sm:flex-row gap-3 justify-center items-center">
            {this.props.onReset && (
              <button
                type="button"
                onClick={this.handleReset}
                className="w-full sm:w-auto px-5 py-2.5 bg-[#1a3c2e] hover:bg-[#11291f] text-[#b8860b] rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Voltar para Lista de Pacientes</span>
              </button>
            )}
            
            <button
              type="button"
              onClick={this.handleReload}
              className="w-full sm:w-auto px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold text-xs flex items-center justify-center gap-2 transition-all border border-slate-200 cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Recarregar para Tentar Novamente</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
