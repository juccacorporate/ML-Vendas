# ML-Vendas — Painel de controle de vendas do Mercado Livre

App React 19 + Vite + Tailwind 4, com servidor Express (`server.ts`) e funções serverless da Vercel (`api/`).
A **planilha do Google Sheets é a fonte da verdade** (via Google Apps Script publicado como Web App).

## Comandos
- `npm run dev` — servidor local (Express + Vite) em http://localhost:3000 (`PORT`/`HOST` configuráveis)
- `npm run build` — build de produção (Vite + bundle do servidor)
- `npx tsc --noEmit` — checagem de tipos (`npm run lint`). Atenção: o projeto **não tem `@types/react`**, então props de JSX não são checadas de fato.

## Arquitetura da sincronização (não quebrar)
- `api/_lib/sheetsProxy.js` é o **único** código que fala com o Apps Script. `server.ts` (local) e `api/*.js` (Vercel) só adaptam req/res. Nunca duplicar essa lógica.
- O proxy só aceita URLs `https://script.google.com/.../exec` (anti-SSRF). Não reabrir CORS `*`.
- `src/App.tsx`: toda leitura da nuvem passa por `applyCloudResult`; toda gravação por `pushSnapshot`.
- Depois de QUALQUER edição do usuário, chamar `setHasPendingWrite(true)` (gravação automática com debounce).
- Proteções contra perda de dados — não remover: `isLocalOnlyMode` (bloqueia gravação sem ter lido a planilha), `getWriteSafetyProblem` (queda de ≥50% de produtos/vendas), trava de lista de produtos vazia no proxy, `LockService` no Apps Script.
- `sanitizeCloudData` reconstrói as vendas a partir de `mlRecords`; se `mlRecords` estiver vazio ele preserva as vendas do ML existentes (não apagar isso).
- Estoque: use `calculateCurrentStock` / `calculateProductSalesVolume` (usam índice em cache por par vendas×produtos). Não reintroduzir loops produto×venda×produto.

## Convenções
- Textos de interface e comentários em português do Brasil.
- Arquivos em CRLF (Windows) — preserve os fins de linha ao editar.
- `localStorage` só via `src/storage.ts` (nunca lança). Não gravar produtos/vendas no localStorage.
- Divisões em indicadores/percentuais: use `safeDiv` (`src/utils.ts`) para evitar NaN/Infinity.
- O script do Apps Script fica em `SheetsIntegration.tsx` (`APPS_SCRIPT_CODE`, um template literal: sem crases nem `${}` dentro). Ao alterá-lo, o usuário precisa colar o novo código no Apps Script e **implantar uma Nova versão**.

## Pontos conhecidos
- A senha do painel é validada no navegador (`App.tsx`) — não é segurança real. Ideal: autenticação no servidor.
- Os scripts `fix_*.py`, `patch_*.py`, `rewrite_*.py` na raiz são resíduos do desenvolvimento no AI Studio e não fazem parte do app.
