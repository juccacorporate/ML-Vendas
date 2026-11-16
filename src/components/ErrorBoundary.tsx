import React from 'react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

// Chaves locais que podem ser descartadas com segurança: a nuvem (Google Sheets) é a fonte da verdade.
const CACHE_PREFIX = 'ml_';
const KEEP_KEYS = new Set(['ml_webapp_url', 'ml_spreadsheet_url']);

/**
 * Última barreira contra a "tela branca": se qualquer componente lançar um erro de renderização,
 * mostramos uma tela de recuperação em vez de derrubar o aplicativo inteiro.
 */
export default class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  // O projeto não instala @types/react, então declaramos `props` manualmente para o TypeScript
  declare readonly props: ErrorBoundaryProps;

  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary] Erro inesperado na interface:', error, info.componentStack);
  }

  private reload = () => {
    window.location.reload();
  };

  private clearCacheAndReload = () => {
    try {
      const keys: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(CACHE_PREFIX) && !KEEP_KEYS.has(k)) keys.push(k);
      }
      keys.forEach(k => localStorage.removeItem(k));
    } catch {
      /* ignorado */
    }
    window.location.reload();
  };

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="min-h-screen bg-[#070707] text-white flex items-center justify-center p-4 font-sans">
        <div className="bg-[#121212] rounded-3xl border border-white/5 w-full max-w-md p-8 text-center space-y-5">
          <span className="text-[10px] font-black tracking-widest bg-rose-500/10 text-rose-400 border border-rose-500/20 px-3 py-1 rounded-full uppercase">
            Algo deu errado
          </span>
          <h2 className="text-xl font-light tracking-tight">O painel encontrou um erro inesperado</h2>
          <p className="text-xs text-white/50 leading-relaxed">
            Seus dados continuam seguros na planilha. Recarregue a página para tentar novamente. Se o problema
            persistir, limpe o cache local e recarregue.
          </p>
          <p className="text-[10px] text-white/30 font-mono break-words">{String(this.state.error.message || this.state.error)}</p>
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={this.reload}
              className="w-full bg-[#FFE600] hover:bg-[#FFE600]/85 text-black font-extrabold text-xs py-3 rounded-xl uppercase tracking-wider cursor-pointer"
            >
              Recarregar página
            </button>
            <button
              type="button"
              onClick={this.clearCacheAndReload}
              className="w-full bg-white/5 hover:bg-white/10 border border-white/10 text-white font-extrabold text-[10px] py-3 rounded-xl uppercase tracking-wider cursor-pointer"
            >
              Limpar cache local e recarregar
            </button>
          </div>
        </div>
      </div>
    );
  }
}
