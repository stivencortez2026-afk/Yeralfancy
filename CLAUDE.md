# Yeral fancy — Guia para o Claude Code

Loja online (PWA, mobile-first, React + Vite + Tailwind + Supabase). App em espanhol; o dono se comunica em português.

## Fluxo de trabalho — deploy automático

Preferência do dono: **toda nova implementação deve ser versionada e publicada automaticamente**.

- Após concluir qualquer alteração: rodar o build para validar, commitar com mensagem clara e **fazer push para `main`**.
- O **Vercel está conectado ao fork `stivencortez/Yeralfancy`** (não ao repo principal). Depois que a mudança entra no `main` do repo principal, o dono clica em **"Sync fork"** no fork para disparar o deploy.
- Variáveis de ambiente do Supabase (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) ficam configuradas no painel do Vercel (não estão no repo — `.env` é ignorado pelo git).

> Requisito para que o push automático funcione: o GitHub App do Claude Code precisa ter
> permissão **Contents: Read and write** no repositório. Sem isso, o push é bloqueado (403)
> e a alteração só entra via Pull Request mesclado manualmente pelo dono.

## Stack / estrutura

- `src/components/tienda/` — componentes da loja (ex.: `TarjetaProducto.jsx`, cards de produto).
- `src/pages/` — páginas da loja (`tienda/`) e do admin (`admin/`).
- `src/lib/supabase.js` — cliente Supabase e mapeadores DB↔app.
- `src/utils/imagen.js` — helpers de imagem (`imgSrc`, `fotoCapa`).
- Build: `npm run build` (Vite → `dist/`).

## Convenções

- Cards de produto usam imagem em **4:5 (`aspect-[4/5]`) com `object-cover`**.
- O enquadramento por produto fica em `producto.capa` (jsonb): `{ indice, x, y, zoom, v: 2 }`. O card aplica via `estiloCapa` (`utils/imagen.js`): `objectPosition` no ponto focal + `scale(zoom)` com `transformOrigin` no mesmo ponto — o ponto escolhido fica fixo ao dar zoom.
- **Zoom é opcional e controlado pelo dono** (pedido em 2026-07: dar/tirar zoom por produto, 0.5×–2.5×, slider + pinça no admin). Com zoom < 1 a sobra do card é preenchida com a própria foto desfocada — nunca faixas cruas.
- Capas antigas **sem `v: 2` e com `zoom ≠ 1`** vêm do editor antigo (matemática diferente) e são ignoradas: renderizam centralizadas e sem zoom (`normalizarCapa`). Não "migrar" esses valores.
- O editor de portada do admin tem prévia **idêntica ao card da loja** (mesmo `estiloCapa`), e o botão **"Aplicar a toda la categoría"** copia zoom/x/y para todos os produtos com fotos da categoria (cada um mantém seu próprio `indice`), via `aplicarCapaACategoria` do `useProductos`.
