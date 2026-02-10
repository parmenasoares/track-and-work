
Objetivo
- Implementar duas novas áreas no app:
  1) “Meus Documentos” (para o utilizador preencher dados de compliance + fazer upload dos documentos no bucket privado `user-documents`)
  2) “Aprovações” (para Coordenador/Admin validar/rejeitar utilizadores e consultar os documentos via links assinados)

Pré-requisito (segurança)
- Confirmar que a proteção “Leaked password protection” já está ativa no backend. (Sem isso, o último alerta de segurança não some.)
- Se ainda não estiver ativa, a implementação pode avançar do mesmo jeito, mas o alerta não será removido até ativar.

O que já existe (confirmado no projeto)
- Tabelas e RLS já criadas:
  - `user_compliance` (dados: NIF/NISS/IBAN/morada…)
  - `user_verifications` (status PENDING/APPROVED/REJECTED + auditoria)
  - `user_document_files` (metadados: doc_type + storage_path etc.)
- Bucket privado `user-documents` já criado + policies em `storage.objects`:
  - Inserir: permitido apenas para o próprio utilizador (pasta `userId/...`)
  - Ler: permitido para o dono e para `is_coordenador_or_above`
  - Deletar: apenas `is_coordenador_or_above` (hoje o próprio utilizador NÃO consegue apagar para substituir)
- Função já criada: `ensure_user_compliance_rows()` para garantir linhas base em `user_compliance` e `user_verifications`.

Problemas que precisamos resolver antes/ao implementar as telas
1) Inicialização de linhas
- Hoje o app não chama `ensure_user_compliance_rows()` automaticamente após login/signup.
- Se um utilizador novo entrar em “Meus Documentos”, pode não existir linha ainda em `user_compliance` / `user_verifications`.

2) Substituição de ficheiros (re-upload)
- Como `user_document_files` tem unique `(user_id, doc_type)`, o utilizador tende a “substituir” o documento do mesmo tipo.
- Porém, com as policies atuais:
  - O utilizador consegue inserir/atualizar metadados na tabela, mas não consegue apagar o ficheiro antigo no bucket (DELETE só para coordenador).
  - Se fizermos re-upload sempre com um path novo, ficamos com objetos antigos “órfãos” no storage.
- Melhor prática: permitir que o próprio utilizador apague os seus próprios objetos em `user-documents` para poder substituir (e opcionalmente permitir apagar o registo em `user_document_files` quando quiser remover).

Decisões de UX (sem bloquear, mas definem a tela)
- “Meus Documentos” terá:
  - Secção 1: Dados (NIF, NISS, IBAN, morada…)
  - Secção 2: Upload de documentos por tipo (CC, PASSPORT, etc.)
  - Secção 3: Estado da verificação + botão “Submeter para aprovação”
- “Aprovações” terá:
  - Lista de utilizadores com status PENDING
  - Detalhe do utilizador: dados + links para abrir/baixar documentos
  - Ações: Aprovar / Rejeitar com notas

Implementação — Backend (migração SQL)
A) Permitir substituição/limpeza de documentos pelo próprio utilizador (recomendado)
- Storage (`storage.objects`):
  - Adicionar policy de DELETE para o dono do ficheiro no bucket `user-documents` quando o path começar por `auth.uid()/...`.
  - (Opcional) Adicionar policy de UPDATE se quisermos suportar “upsert” de storage, mas não é obrigatório; podemos trabalhar com delete+insert.
- Database (`public.user_document_files`):
  - Adicionar policy de DELETE para o dono (user_id = auth.uid()) e/ou para coordenador+.
  - Isto permite o utilizador remover um documento (metadado) e fazer upload novamente sem deixar lixo.

B) (Opcional, mas útil) Restringir uploads por tipo MIME e tamanho via app
- Não é policy do DB; vamos validar no frontend (ex: aceitar PDF + imagens, 10MB).

Implementação — Frontend (novas páginas e rotas)
1) Criar uma rota/página “Meus Documentos”
- Novo ficheiro: `src/pages/MyDocuments.tsx`
- Funcionalidades:
  - Ao carregar, garantir linhas base:
    - `supabase.rpc("ensure_current_user_row")` (para garantir `users`)
    - `supabase.rpc("ensure_user_compliance_rows")`
  - Buscar:
    - `user_compliance` do utilizador logado
    - `user_verifications` do utilizador logado
    - `user_document_files` do utilizador logado
  - Form de compliance:
    - Inputs para nif/niss/iban/morada
    - Guardar via upsert/update (RLS permite ALL do próprio)
  - Upload por tipo de documento:
    - Para cada `document_type` (enum), mostrar card com:
      - Estado: “Não enviado” / “Enviado em dd/mm” (via `user_document_files.created_at`)
      - Botão “Enviar/Substituir”
      - (Opcional) Botão “Remover”
    - Upload flow (por doc_type):
      - Validar: tamanho <= 10MB e tipo `image/*` ou `application/pdf`
      - Se existir documento anterior:
        - Se tivermos policy de delete do dono: apagar objeto antigo no storage (pelo `storage_path`)
      - Fazer upload para `user-documents` com path: `${userId}/${doc_type}/${uuid}-${originalName}`
      - Upsert em `user_document_files` (como existe unique por tipo) para atualizar `storage_path`, `file_name`, `mime_type`, `size_bytes`
  - “Submeter para aprovação”:
    - Atualizar `user_verifications`:
      - `status = 'PENDING'`
      - `submitted_at = now()`
      - limpar `review_notes`, `reviewed_at`, `reviewed_by` (opcional)
    - Mostrar feedback ao utilizador (toast)

2) Criar uma rota/página “Aprovações”
- Novo ficheiro: `src/pages/AdminApprovals.tsx` (nome pode ser “Approvals”)
- Acesso:
  - Criar componente de rota novo `CoordinatorRoute`:
    - Similar ao `AdminRoute`, mas usando RPC `is_coordenador_or_above`
    - Permite COORDENADOR, ADMIN, SUPER_ADMIN
- Funcionalidades da página:
  - Lista de `user_verifications` com `status='PENDING'`, ordenado por `submitted_at desc`
  - Para cada utilizador:
    - Carregar perfil (tabela `users`) e dados `user_compliance`
    - Carregar `user_document_files` do utilizador
  - Visualização de documentos:
    - Para cada doc, criar link assinado temporário (ex: 60s) via `supabase.storage.from("user-documents").createSignedUrl(storage_path, 60)`
    - Botão “Abrir” / “Baixar”
  - Ações:
    - Aprovar:
      - `status='APPROVED'`, `reviewed_at=now()`, `reviewed_by=auth.uid()`, `review_notes` opcional
    - Rejeitar:
      - `status='REJECTED'`, `reviewed_at=now()`, `reviewed_by=auth.uid()`, `review_notes` obrigatório (para orientar correção)
  - Após aprovar/rejeitar:
    - invalidar queries do React Query e atualizar lista

3) Navegação
- Adicionar botões/atalhos no Dashboard:
  - Para todos: “Meus Documentos”
  - Para coordenador+: “Aprovações”
- Adicionar rotas em `src/App.tsx`:
  - `/my-documents` protegido por `ProtectedRoute`
  - `/admin/approvals` protegido por `CoordinatorRoute`

4) Textos e internacionalização
- Atualizar `src/lib/i18n.ts` com chaves novas em PT/EN, por exemplo:
  - myDocuments, approvals, submitForApproval, verificationStatus, approved, rejected, pending, upload, replace, remove, reviewNotes, etc.
- Manter a maior parte dos rótulos em PT (como o resto do projeto), mas com fallback EN consistente.

Implementação — Ajuste no Login (robustez)
- Após login bem-sucedido e após signup (quando o utilizador fizer o primeiro login), chamar:
  - `ensure_current_user_row()` e `ensure_user_compliance_rows()`
- Benefício: garante que as páginas “Dashboard” e “Meus Documentos” sempre encontram as linhas necessárias.

Testes (end-to-end)
1) Fluxo do utilizador (OPERADOR)
- Criar conta > confirmar email > login
- Abrir “Meus Documentos”
- Preencher NIF/NISS/IBAN/morada e salvar
- Upload de 1 documento (ex: CC) e verificar se aparece como “enviado”
- Substituir o mesmo documento e confirmar que:
  - O metadado atualiza
  - O ficheiro antigo é removido (se implementarmos delete do dono)
- Clicar “Submeter para aprovação” e confirmar status “PENDING”

2) Fluxo do coordenador/admin
- Entrar como COORDENADOR/ADMIN
- Abrir “Aprovações”
- Abrir documentos (links assinados)
- Rejeitar com nota e confirmar que o utilizador vê a nota em “Meus Documentos”
- Aprovar e confirmar status final

3) Segurança/RLS
- Confirmar que um utilizador não consegue ler documentos de outro utilizador
- Confirmar que coordenador+ consegue ler e rever

Arquivos que serão alterados/criados (quando aprovar o plano)
- Criar:
  - `src/pages/MyDocuments.tsx`
  - `src/pages/AdminApprovals.tsx`
  - `src/components/CoordinatorRoute.tsx` (ou `src/components/CoordinatorOrAboveRoute.tsx`)
- Editar:
  - `src/App.tsx` (rotas)
  - `src/pages/Dashboard.tsx` (atalhos)
  - `src/pages/Login.tsx` (chamar ensure_* após auth)
  - `src/lib/i18n.ts` (novas chaves)
- Migração SQL:
  - Policies adicionais para permitir delete do próprio utilizador em `user-documents` e (opcional) delete em `user_document_files`

Riscos e mitigação
- Links assinados expiram rápido (60s): OK por segurança; vamos gerar novamente ao clicar “Abrir” se necessário.
- Se não permitirmos delete pelo dono no storage: haverá objetos órfãos. Por isso o plano recomenda adicionar a policy de DELETE do dono.
- Tipos de documento fixos no enum: a UI vai suportar os que já existem hoje; se mais tipos forem necessários no futuro, faremos nova migração para expandir o enum.

Resultado esperado
- Utilizadores conseguem enviar documentos e submeter para aprovação.
- Coordenadores/Admins conseguem aprovar/rejeitar com notas e visualizar documentos com segurança via links temporários.
- O processo fica alinhado com o fluxo administrativo já existente no sistema.
