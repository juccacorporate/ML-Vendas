with open('src/components/MLImport.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

box_str = """
              {/* Box: Relatório de Recebimentos */}
              <div className="bg-[#121212] border border-white/5 rounded-3xl p-6 shadow-xl space-y-5 mt-6">
                <div className="flex items-center justify-between border-b border-white/5 pb-4">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-emerald-400"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>
                    Relatório de Recebimentos (Liberações)
                  </h3>
                  <span className="text-[10px] text-white/40 font-mono">Formatos: XLS, XLSX, CSV</span>
                </div>

                <div className="bg-emerald-400/10 border border-emerald-400/20 rounded-2xl p-4 mb-4">
                  <p className="text-xs text-emerald-400 font-bold mb-1">Baixa Automática (Dinheiro Entrou)</p>
                  <p className="text-[11px] text-white/60 leading-relaxed">
                    Suba a planilha de Recebimentos. O sistema identificará automaticamente os status de <strong>"Liberação"</strong> e cruzará o número da operação (ID) para alterar o status das suas vendas para <strong>Concluída (Paga)</strong>.
                  </p>
                </div>

                <div className="border-2 border-dashed border-emerald-400/20 hover:border-emerald-400/40 bg-emerald-400/5 rounded-2xl p-8 text-center transition-all relative">
                  <input
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    onChange={handleFileUploadRecebimentos}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <div className="flex flex-col items-center space-y-3 pointer-events-none">
                    <div className="bg-emerald-400/10 text-emerald-400 p-4 rounded-full">
                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-8 h-8"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><path d="M8 13h2"/><path d="M8 17h2"/><path d="M14 13h2"/><path d="M14 17h2"/></svg>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-bold text-white">Arraste o relatório de Recebimentos aqui</p>
                    </div>
                  </div>
                </div>
              </div>"""

content = content.replace(box_str, "")

# Now insert it exactly after the right button
target = """                </button>
              </div>
            </div>"""

replacement = """                </button>
              </div>
            </div>
""" + box_str

content = content.replace(target, replacement, 1)

with open('src/components/MLImport.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
