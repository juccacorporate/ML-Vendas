/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { X, Download, Copy, Check, Code2, FileCode, ExternalLink, Sparkles, FolderArchive, Layers } from 'lucide-react';

interface CodeExportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CodeExportModal({ isOpen, onClose }: CodeExportModalProps) {
  const [copiedAll, setCopiedAll] = useState(false);
  const [copiedFile, setCopiedFile] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [fullCode, setFullCode] = useState<string>('');
  const [selectedFile, setSelectedFile] = useState<string>('src/types.ts');
  const [fileList, setFileList] = useState<{ path: string; content: string }[]>([]);

  useEffect(() => {
    if (isOpen) {
      loadCodebase();
    }
  }, [isOpen]);

  const loadCodebase = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/export-codebase');
      if (res.ok) {
        const text = await res.text();
        setFullCode(text);

        // Parse individual files from the concatenated text
        const sections = text.split(/={80}\nFILE:\s*([^\n]+)\n={80}\n\n/);
        const parsed: { path: string; content: string }[] = [];
        for (let i = 1; i < sections.length; i += 2) {
          const path = sections[i].trim();
          const content = sections[i + 1] ? sections[i + 1].trim() : '';
          parsed.push({ path, content });
        }
        setFileList(parsed);
        if (parsed.length > 0 && !parsed.some(p => p.path === selectedFile)) {
          setSelectedFile(parsed[0].path);
        }
      }
    } catch (err) {
      console.error('Falha ao carregar código para exportação:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = '/api/download-codebase';
    link.setAttribute('download', 'PROJETO_COMPLETO_CLAUDE.txt');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCopyAll = async () => {
    try {
      if (!fullCode) {
        const res = await fetch('/api/export-codebase');
        const text = await res.text();
        await navigator.clipboard.writeText(text);
      } else {
        await navigator.clipboard.writeText(fullCode);
      }
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 3000);
    } catch (err) {
      console.error('Falha ao copiar:', err);
    }
  };

  const handleCopySingleFile = async (path: string, content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedFile(path);
      setTimeout(() => setCopiedFile(null), 2500);
    } catch (err) {
      console.error('Falha ao copiar arquivo:', err);
    }
  };

  const currentFileObj = fileList.find(f => f.path === selectedFile) || fileList[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="bg-[#121212] border border-white/15 w-full max-w-5xl rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-[#161616]">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-[#FFE600]/15 text-[#FFE600] rounded-xl border border-[#FFE600]/30 shadow-[0_0_15px_rgba(255,230,0,0.15)]">
              <Code2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider bg-[#FFE600] text-black px-1.5 py-0.5 rounded">
                  CLAUDE & LLMs
                </span>
                <span className="text-xs text-white/50">Exportação Integral Corrida</span>
              </div>
              <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                Código-Fonte Completo da Plataforma
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownload}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold bg-[#FFE600] hover:bg-[#ffe600]/90 text-black rounded-xl shadow-lg transition-all cursor-pointer"
              title="Baixar arquivo único formatado com todos os fontes"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Baixar Arquivo Completo</span>
              <span className="sm:hidden">Baixar</span>
            </button>

            <button
              onClick={handleCopyAll}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold bg-white/10 hover:bg-white/20 text-white border border-white/15 rounded-xl transition-all cursor-pointer"
              title="Copiar todo o código para colar no Claude"
            >
              {copiedAll ? (
                <>
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span className="text-emerald-400 font-extrabold">Copiado Tudo!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>Copiar Tudo</span>
                </>
              )}
            </button>

            <button
              onClick={onClose}
              className="p-2 text-white/50 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer ml-2"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Info Banner */}
        <div className="bg-gradient-to-r from-amber-500/10 via-purple-500/10 to-blue-500/10 border-b border-white/10 px-6 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs text-white/80">
            <Sparkles className="w-4 h-4 text-[#FFE600] shrink-0" />
            <span>
              Todos os <strong>{fileList.length || 18} arquivos</strong> consolidados em formato contínuo e ordenado, com marcadores <code className="bg-black/40 px-1 py-0.5 rounded text-[#FFE600]">FILE: caminho</code> reconhecidos diretamente pelo Claude.
            </span>
          </div>
          <div className="text-[11px] font-mono text-white/50 shrink-0">
            {fullCode ? `${(fullCode.length / 1024).toFixed(0)} KB de código limpo` : 'Carregando...'}
          </div>
        </div>

        {/* Modal Body: File Explorer & Code Preview */}
        <div className="flex-1 min-h-0 flex flex-col md:flex-row overflow-hidden">
          {/* Left Column: File Tree list */}
          <div className="w-full md:w-72 bg-[#0e0e0e] border-r border-white/10 flex flex-col shrink-0">
            <div className="p-3 border-b border-white/10 flex items-center justify-between text-xs font-bold text-white/70">
              <span className="flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-[#FFE600]" />
                Arquivos do Projeto ({fileList.length})
              </span>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1 divide-y divide-white/5">
              {fileList.map((f) => {
                const isSelected = f.path === selectedFile;
                return (
                  <button
                    key={f.path}
                    onClick={() => setSelectedFile(f.path)}
                    className={`w-full text-left px-2.5 py-2 rounded-lg text-xs font-mono transition-all flex items-center justify-between group cursor-pointer ${
                      isSelected
                        ? 'bg-[#FFE600] text-black font-bold shadow-md'
                        : 'text-white/70 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <FileCode className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-black' : 'text-[#FFE600]'}`} />
                      <span className="truncate">{f.path}</span>
                    </div>
                    <span className={`text-[10px] shrink-0 ${isSelected ? 'text-black/70' : 'text-white/40'}`}>
                      {f.content.split('\n').length} l
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right Column: Code Viewer with File Actions */}
          <div className="flex-1 min-w-0 flex flex-col bg-[#0a0a0a]">
            {currentFileObj ? (
              <>
                <div className="flex items-center justify-between px-4 py-2.5 bg-[#141414] border-b border-white/10">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-white">{currentFileObj.path}</span>
                    <span className="text-[10px] text-white/40 font-mono">
                      ({currentFileObj.content.split('\n').length} linhas • {(currentFileObj.content.length / 1024).toFixed(1)} KB)
                    </span>
                  </div>
                  <button
                    onClick={() => handleCopySingleFile(currentFileObj.path, currentFileObj.content)}
                    className="flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-lg bg-white/10 hover:bg-white/20 text-white transition-all cursor-pointer"
                  >
                    {copiedFile === currentFileObj.path ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-400 font-bold">Arquivo Copiado!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copiar Este Arquivo</span>
                      </>
                    )}
                  </button>
                </div>
                <div className="flex-1 overflow-auto p-4 font-mono text-xs text-white/80 leading-relaxed bg-[#0a0a0a]">
                  <pre className="whitespace-pre">{currentFileObj.content}</pre>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-white/40 text-xs">
                {loading ? 'Carregando arquivos...' : 'Nenhum arquivo selecionado'}
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer with Instructions for Claude */}
        <div className="p-4 bg-[#141414] border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="text-white/60">
            💡 <strong>Dica para o Claude:</strong> No Claude.ai, você pode simplesmente <strong>anexar o arquivo .txt baixado</strong> no chat ou criar um <strong>Project</strong> e subir o arquivo na aba de conhecimento!
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyAll}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl font-bold cursor-pointer transition-all"
            >
              {copiedAll ? '✓ Copiado!' : 'Copiar Tudo'}
            </button>
            <button
              onClick={handleDownload}
              className="px-4 py-2 bg-[#FFE600] hover:bg-[#ffe600]/90 text-black font-extrabold rounded-xl shadow-lg cursor-pointer transition-all"
            >
              Baixar .txt Completo
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
