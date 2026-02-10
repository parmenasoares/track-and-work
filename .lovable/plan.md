
Objetivo
- Atualizar o PWA para refletir a marca AGRO‑X: ícones (favicon/PWA) e cores do “tema” (barra do sistema) coerentes com o verde AGRO‑X, mantendo boa legibilidade em modo claro e em modo escuro.

Decisões já confirmadas
- Cor principal do PWA: Verde AGRO‑X.
- Modo escuro: usar duas cores (claro/escuro) para melhor legibilidade.
- Estilo dos ícones: Símbolo (recomendado), em vez do logótipo completo.

O que existe hoje (diagnóstico rápido)
- `vite.config.ts` (VitePWA):
  - `theme_color` ainda está azul (`#1e73be`) e `background_color` está claro (`#f8f9fa`).
  - Ícones do manifest apontam para `/placeholder.svg` (não é ideal para instalação e legibilidade).
- `public/` só tem `favicon.ico`, `placeholder.svg`, `robots.txt`.
- `index.html` define `<meta name="theme-color" content="#1e73be" />` (uma única cor; não distingue claro/escuro).
- O logótipo AGRO‑X está disponível em `src/assets/agro-x-logo.png` (vamos usar como base para construir o símbolo/ícone).

Abordagem (alto nível)
1) Criar ícones PWA reais (PNG) com o símbolo AGRO‑X, com variantes “maskable” para Android.
2) Atualizar o `manifest` (VitePWA) para usar esses ícones e atualizar `theme_color`/`background_color`.
3) Ajustar `index.html` para `theme-color` por modo (claro vs escuro) com `media="(prefers-color-scheme: ...)"`, garantindo legibilidade.
4) (Recomendado para robustez) Adicionar `navigateFallbackDenylist: [/^\/~oauth/]` no Workbox para evitar cache indevido de rotas de autenticação.

Detalhes de implementação (o que vou mudar)
A) Novos assets (em `public/`)
- Criar e adicionar:
  - `public/pwa-icon-192.png`
  - `public/pwa-icon-512.png`
  - `public/pwa-maskable-192.png`
  - `public/pwa-maskable-512.png`
  - (Opcional, mas bom) `public/apple-touch-icon.png` (180x180)
  - (Opcional) substituir/atualizar `public/favicon.ico` e/ou adicionar `public/favicon-32.png`, `public/favicon-16.png`
- Design dos ícones:
  - Usar o “símbolo” (X/folha) com recorte simples e alto contraste.
  - Garantir “safe area” para maskable (o símbolo não pode encostar às bordas; ideal ~10–15% de margem).
  - Fundo:
    - Para ícone “any”: fundo sólido claro (ex.: branco) ou verde escuro, dependendo do contraste final.
    - Para “maskable”: fundo sólido (geralmente funciona melhor em verde AGRO‑X para consistência).
  - Nota: Vou preparar os PNG de forma a ficarem legíveis em 192px (o ponto crítico de legibilidade).

B) `vite.config.ts` (VitePWA manifest e cache)
- Atualizar `manifest.theme_color` para verde AGRO‑X (claro).
- Ajustar `manifest.background_color` para um claro neutro coerente com o app (ex.: `#f8f9fa` pode ficar).
- Substituir `icons`:
  - `src: '/pwa-icon-192.png'`, `sizes: '192x192'`, `type: 'image/png'`, `purpose: 'any'`
  - `src: '/pwa-icon-512.png'`, `sizes: '512x512'`, `type: 'image/png'`, `purpose: 'any'`
  - `src: '/pwa-maskable-192.png'`, `sizes: '192x192'`, `type: 'image/png'`, `purpose: 'maskable'`
  - `src: '/pwa-maskable-512.png'`, `sizes: '512x512'`, `type: 'image/png'`, `purpose: 'maskable'`
- Atualizar `includeAssets` para incluir os novos ficheiros (para garantir que entram no build).
- Workbox:
  - Adicionar `navigateFallbackDenylist: [/^\/~oauth/]` para impedir cache da rota de OAuth/redirect.

C) `index.html` (theme-color por modo + ícones)
- Substituir o `<meta name="theme-color" ...>` atual por:
  - Um `theme-color` para modo claro (verde AGRO‑X)
  - Um `theme-color` para modo escuro (verde mais escuro ou quase-preto com leve tom verde, para legibilidade)
  - Exemplo de estrutura:
    - `<meta name="theme-color" media="(prefers-color-scheme: light)" content="...">`
    - `<meta name="theme-color" media="(prefers-color-scheme: dark)" content="...">`
- Adicionar links de ícones:
  - `<link rel="apple-touch-icon" href="/apple-touch-icon.png">` (se adicionarmos o asset)
  - `<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png">` (se adicionarmos)
  - (Manter `favicon.ico` por compatibilidade)

Cores (proposta concreta)
- Vou derivar as cores do verde do logótipo para manter coerência.
- Proposta inicial (ajustável após ver no preview):
  - Claro (theme-color): verde AGRO‑X “principal” (um verde médio/lima mais escuro para não estourar em barras do sistema).
  - Escuro (theme-color): verde muito escuro (quase preto esverdeado) para garantir contraste com ícones/texto do sistema.
- Se, após teste em dispositivos, a barra ficar “lavada” ou com baixo contraste, ajusto os hex para melhorar a legibilidade (isto é comum e esperado).

Plano de testes (end-to-end)
1) No browser (desktop):
- Abrir DevTools → Application → Manifest:
  - Confirmar que os ícones (192/512 e maskable) aparecem corretamente e não são `placeholder.svg`.
  - Confirmar `theme_color` e `background_color`.

2) Instalação como PWA:
- Chrome/Edge (Android simulado ou real): instalar “Add to Home screen”.
  - Verificar ícone no launcher e splash (se aplicável).
  - Verificar recorte maskable (não cortar o símbolo).
- iOS (se aplicável): “Share → Add to Home Screen”.
  - Confirmar apple-touch-icon (se incluirmos) e aspeto do ícone.

3) Modo claro/escuro:
- Alternar “prefers-color-scheme” no DevTools:
  - Confirmar que o `theme-color` muda entre claro e escuro.
  - Confirmar que a barra do sistema mantém boa legibilidade.

Riscos e mitigação
- Ícone a partir do logótipo: o recorte do “símbolo” pode precisar de 1–2 iterações para ficar perfeito em tamanhos pequenos.
  - Mitigação: focar em formas simples, alto contraste e safe area grande; validar em 192px.
- `theme-color` em diferentes SO/browsers varia.
  - Mitigação: testar em claro/escuro e ajustar hex.

Checklist de aceitação
- [ ] Manifest aponta para ícones PNG AGRO‑X (any + maskable) e já não usa `placeholder.svg`.
- [ ] `theme-color` é verde AGRO‑X em claro e muda para um verde escuro em modo escuro.
- [ ] Ícones ficam legíveis no launcher e não são cortados (maskable).
- [ ] Rotas sensíveis (`/~oauth`) não ficam presas em cache do service worker.
