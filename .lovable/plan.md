
Objetivo
- Atualizar a frase “Controlo de máquinas e herdade — ...” para um texto 100% alinhado com a marca AGRO-X CONTROL, em PT-PT e EN, e mover esse texto para o sistema de traduções (i18n), para ficar consistente e fácil de manter.

Contexto (o que existe hoje)
- A frase está hardcoded em `src/pages/Login.tsx` (linha ~128-130).
- O i18n vive em `src/lib/i18n.ts` e o hook `useLanguage()` expõe `t(key)` onde `key` tem de existir em `translations.pt` (e também em `translations.en`).
- O título principal já vem de `t("appTitle")` no header do dashboard; a frase do login ainda não está em i18n.

Decisão de copy (confirmada)
- Tom escolhido: “Operacional e direto”.

Proposta de textos (Operacional e direto)
- PT-PT (nova tagline):
  - “Controlo operacional no terreno — rápido, rastreável e mobile-first.”
- EN:
  - “Operational field control — fast, traceable, mobile-first.”

Nota: se quiser, posso ajustar 1-2 palavras para encaixar melhor no vosso vocabulário interno (ex.: “operações”, “frota”, “máquinas”), mas a implementação será igual.

Alterações planeadas (código)
1) i18n: adicionar nova chave para a tagline
- Ficheiro: `src/lib/i18n.ts`
- Adicionar uma nova key (ex.: `appTagline`) dentro de:
  - `translations.pt.appTagline`
  - `translations.en.appTagline`
- Garantir que a key existe em ambos os idiomas para não quebrar o TypeScript nem o runtime.

2) UI: trocar texto hardcoded por tradução
- Ficheiro: `src/pages/Login.tsx`
- Substituir o `<p>` com a frase hardcoded por:
  - `{t("appTagline")}`

3) (Opcional, mas recomendado) Consistência do branding no Login
- Se o texto “AGRO-X CONTROL” (o label pequeno acima do H1) estiver hardcoded, podemos manter assim (não é problema), ou mover também para `t("appTitle")` para ficar 100% consistente com o resto.
- Só faço isto se concordar, porque é uma mudança pequena mas mexe no UI.

Plano de testes (end-to-end)
- Teste PT:
  1. Abrir o app numa janela privada (ou limpar `fleet_language` no localStorage).
  2. Selecionar “Português (Portugal)”.
  3. Ir ao Login e confirmar que a frase aparece em PT-PT e está correta visualmente (quebra de linha, tamanhos).
- Teste EN:
  1. Trocar para “English”.
  2. Confirmar que a mesma área mostra a versão EN.
- Teste de regressão:
  - Confirmar que não há erros de TypeScript e que `t("appTagline")` não devolve `undefined`.

Impacto e risco
- Baixo risco: é uma troca de texto + nova key no i18n.
- Benefício: copy consistente, traduzível e centralizada (fácil de alterar no futuro sem “caçar” strings no UI).

Checklist de aceitação
- [ ] A frase do Login não está hardcoded.
- [ ] A frase muda corretamente entre PT e EN.
- [ ] Não há erros no console relacionados com tradução em falta.
- [ ] O tom final está “operacional e direto”, como definido.
