# Progresso do FOLGA

## Concluído

1. Fundação Next.js App Router/TS estrito/Tailwind/Lucide, identidade, PWA, demo isolada, autenticação SSR e endpoints protegidos.
2. Entidades/Zod e domínio compartilhado; contas, movimentos, transferências, estornos, ajustes e detalhes de fatura.
3. Recorrências, ocorrências idempotentes, pagamentos/reversão, contratos/recebimentos, atividades e projeção conservadora com cenários separados.
4. Inventário de dívidas/simulador, auditoria determinística, tarefas, CSV revisado por lote, exportação e backup.
5. Migrations com tabelas relacionais, RLS, FKs compostas, gravação atômica/CAS, testes, QA mobile e desktop, documentação e setup reutilizável.

## Evidências executadas

- `npm ci`: concluído. A primeira repetição falhou por falta de disco durante extração de imagem Docker; a instalação foi restaurada e repetida com sucesso após liberar os artefatos dessa tentativa.
- `npm run lint`: passou, sem warnings.
- `npm run typecheck`: passou.
- `npm test`: **30 testes passaram** (domínio, CSV e proteção de origem atrás de proxy).
- `npm run build`: passou; rotas públicas, privadas e proxy compilados para produção.
- Playwright demo: **8 cenários passaram**, desktop e mobile 360px. Onboarding retomável, entrada/despesa, edição/recálculo, pagamento, persistência após reload, importação fictícia revisada, planejamento/atividades/contratos, simulador, tarefas e privacidade. Testes reais ficam explicitamente pulados quando esse runner não recebe configuração.
- Playwright autenticado: **4 cenários passaram**, desktop e mobile. Sessão real GoTrue por e-mail/senha, rota privada, persistência PostgreSQL, importação, logout, exclusão com reautenticação e cascata, cadastro e solicitação de recuperação. Fixtures inteiramente fictícias e usuários removidos ao final.
- `npm run test:backend`: **1 cenário de integração com múltiplas asserções passou**, usando sessões reais de A/B, anônimo, PostgREST e PostgreSQL. Inclui isolamento, referência a conta de outro usuário, concorrência, pagamento/lote repetidos e rollback de transferência incompleta.
- `bash scripts/test-sql.sh`: ambas as migrations e asserções SQL passaram, incluindo repetição do runner em banco descartável, RLS A/B/anônimo, DATE, escrita direta bloqueada, atomicidade e cascatas. Essa verificação isolada usa identidade SQL simulada; a verificação HTTP acima usa autenticação real.
- Capturas fictícias inspecionadas em desktop e 360px; sem overflow horizontal. Nenhum erro de página no fluxo de navegador monitorado. Ícones PNG derivados do SVG original e manifest entregues.

## Diagnósticos resolvidos

- Cache npm fora do perfil somente leitura: configurado em `/tmp/folga-npm`.
- Browser Playwright indisponível por bloqueio no CDN: usado Chromium de sistema, sem desativar TLS ou checksums.
- Supabase CLI tentou baixar imagens PostgreSQL 17/15 acima do disco disponível. A tentativa foi interrompida, sem usar artefatos incompletos. Validação final usa composição leve com as imagens oficiais GoTrue v2.197.0, PostgREST v16.5 e PostgreSQL 15 Alpine; a imagem completa do CLI **não** iniciou neste ambiente.
- Inicialização do auth local: search_path estabelecido antes da primeira migration do serviço.
- Testes autenticados encontraram normalização de origem para localhost pelo proxy Next. Corrigida a checagem usando Host/protocolo público, preservando rejeição de origem diferente e cross-site, com teste de regressão.
- Corrida entre gravação do onboarding e abertura de formulário: gravações de fundo não fecham mais modais recém-abertos; Adicionar aguarda a gravação em andamento.

## Configuração salva

`install_script` e `start_skill` foram salvos no rascunho do ambiente. Incluem checkout existente, Node 24, npm ci, testes/build e reinício dos serviços necessários em futuras tarefas. Domínios adicionais salvos para documentação e instalação de browser: supabase.com, nextjs.org, cdn.playwright.dev e storage.googleapis.com; presets anteriores preservados. Rascunho salvo não significa publicação nem validação de restauração em nova tarefa.

## Pendente externo / próximo passo concreto

- Configurar um projeto Supabase externo com as migrations e variáveis de `.env.example`, URLs/callbacks e provedor SMTP. **Não há projeto externo conectado**, nem deploy Vercel realizado.
- Entrega efetiva de e-mail, link recebido e troca de senha pelo callback de recuperação **não foram validados de ponta a ponta**. O backend local usa mailer noop; somente solicitação e retorno da API foram testados. Validar esse ciclo com SMTP configurado antes de abrir contas para usuários.
- O modo real foi validado **localmente** com autenticação, persistência e isolamento. Isso não comprova a configuração de um Supabase hospedado nem produção.
- O usuário pode revisar/salvar as configurações do ambiente e publicar pela interface quando desejar. Nenhuma contratação ou publicação automática foi feita.

## Limites documentados

Lista cronológica em vez de calendário em grade; backup JSON somente de saída; inventário de dívida e compromisso de caixa cadastrados explicitamente para evitar duplicação. Empréstimos criam passivo com condições pendentes, nunca taxa zero presumida. A composição local de testes é descartável, sem dados reais, e não é um deploy de produção. Recursos futuros listados no pedido não têm botões falsos.
