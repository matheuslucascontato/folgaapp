# FOLGA

**Seu dinheiro com espaço para respirar.** Organizador financeiro brasileiro, mobile first, sem conexão com bancos ou pagamentos reais.

## Executar

Requisitos: Node.js 24 (validado), npm 11. As versões exatas estão em `package-lock.json`.

```sh
npm ci
npm run dev
```

Abra `/demo` para uma demonstração inteiramente fictícia, independente de credenciais. O banner é permanente, os dados ficam somente na chave `folga-demo-v1` do navegador e podem ser reiniciados. Upload de extratos está desabilitado nesse modo; há apenas um exemplo fictício para explorar a importação.

`/login` explica a configuração ausente quando não existe Supabase. Não existe fallback silencioso de dados reais para demo. `/app` exige usuário autenticado.

## Modo real com Supabase

1. Crie/use um projeto Supabase (nenhum serviço é contratado automaticamente).
2. Copie `.env.example` para `.env.local` e configure URL e chave **publishable**. A chave anônima legada também funciona no campo publishable quando usada com RLS. Nunca use a chave administrativa nesse campo público.
3. Aplique **as duas migrations**, em ordem, por `supabase db push` em projeto vinculado ou pelo SQL Editor. Faça isso em um projeto novo; não substitua tabelas de outro produto.
4. Em Authentication, habilite e-mail/senha, configure Site URL e permita o callback `/auth/confirm` na origem local e na origem de produção. A confirmação de cadastro e recuperação usam o fluxo PKCE com cookies do `@supabase/ssr`. Use o template padrão compatível com confirmação por código; não redirecione tokens para `/demo`.
5. Configure envio de e-mails no Supabase para produção. O callback de recuperação preserva `next=/login?recovery=1`. Após o link, preencha a nova senha.
6. Exclusão da conta inteira requer `SUPABASE_SERVICE_ROLE_KEY` **somente no servidor**. A rota DELETE exige sessão, mesma origem, confirmação EXCLUIR e senha atual. Excluir somente dados não requer essa chave.
7. Reinicie o servidor e, após alterar variáveis públicas, refaça o build.

Não informe CPF, senha bancária ou cartão completo. O MVP não promete certificação ou conformidade jurídica.

### Backend local

Docker e CLI Supabase estão disponíveis via dependência de desenvolvimento. Para reduzir disco e memória, inicie só os serviços necessários:

```sh
npx supabase start --exclude studio,postgres-meta,realtime,storage-api,imgproxy,edge-runtime,logflare,vector,supavisor
npm run test:backend
CHROMIUM_PATH=/usr/bin/chromium npm run test:real
```

O CLI requer diretório de configuração gravável no perfil do usuário. Para um projeto já inicializado, use `npx supabase db reset` **apenas no banco local de desenvolvimento descartável** para reaplicar migrations. Não execute reset em produção. Não há seed automático de usuários. O seed fictício opt-in é `src/lib/demo.ts`, consumido exclusivamente em `/demo`.

Os runners locais obtêm as credenciais locais do CLI em memória, criam usuários fictícios e os removem no final. Não imprimem chaves. `test:real` inicia um servidor isolado na porta 3001. Não aponte esses testes a um banco com dados reais.

## Comandos

```sh
npm run typecheck
npm run lint
npm test
npm run build
npm start
npx playwright install chromium
npm run test:e2e
```

Se já houver Chromium do sistema: `CHROMIUM_PATH=/usr/bin/chromium npm run test:e2e`. Sem Supabase, os testes de UI reais são explicitamente pulados; a demo não comprova RLS. `npm run test:backend` falha se o backend local não estiver disponível, sem simular um resultado verde.

## Fluxos implementados

- Onboarding retomável/pulável, contas, abertura datada, arquivamento, reserva segregada e reserva adicional; privacidade de valores.
- CRUD de movimentos, busca/tipos, categorias e subcategorias, transferências em pares, ajuste explícito de saldo, estorno vinculado e empréstimo com passivo no inventário.
- Projeção conservadora com mínimo intermediário, atrasos imediatos, renda provável separada e cálculo exposto; fechamento do mês.
- Compromissos/assinaturas mensais, parcelas, edição de uma ocorrência ou futuras, geração idempotente ao carregar, pagamento e desfazimento; descontos em folha fora do caixa.
- Contratos com cronograma real, registro idempotente de recebimento, atividades com custos incompletos sinalizados.
- Dívidas com taxa desconhecida distinta de zero e CET separado; comparação bola de neve/avalanche, extra configurável, exclusões, alertas, tabela exportável e limite de 600 meses.
- Auditoria determinística e tarefas com economia potencial/confirmada e data de efeito.
- CSV mapeável, prévia/erros, revisão de duplicatas e hash, confirmação/desfazimento atômicos; detalhes informativos de fatura, exportações com neutralização de fórmulas e backup JSON versionado.
- PWA com manifest, ícones originais e resposta offline explicativa. Não há sincronização offline; service worker não armazena dados autenticados.

## Arquitetura e segurança

`src/lib/domain.ts` contém entidades tipadas/Zod e as regras compartilhadas pelos dois modos; `csv.ts` cuida de importação/exportação e `demo.ts` fornece somente ficção. `src/components` apresenta os fluxos. Rotas de servidor validam payload e sessão; proxy renova cookies, sem usar localStorage para dados reais. Respostas privadas são `no-store`.

O transporte é um agregado JSON versionado por usuário com revisão otimista. A gravação RPC usa `auth.uid()`, compara revisão e falha em conflito, preservando o estado anterior. Um trigger valida invariantes e outro projeta o agregado em tabelas relacionais **na mesma transação**: perfis, contas, categorias, atividades, dívidas, recorrências/ocorrências, transferências/movimentos, contratos/recebimentos, tarefas, lotes e detalhes de fatura. Essas tabelas têm DATE, BIGINT, NUMERIC e FKs compostas por usuário, além de RLS em todas as tabelas de usuário. Escrita direta nas projeções é revogada; somente o trigger protegido as altera. O documento versionado serve à leitura e ao compare-and-swap; não é uma segunda gravação independente. O `updated_at` do agregado é UTC.

Esse desenho simples regrava o agregado de um usuário; é adequado ao MVP manual, não a extratos de milhões de linhas. Evolução futura deve migrar para comandos incrementais antes de grandes volumes. Conflitos em múltiplas abas pedem recarregamento, sem sobrescrever dados silenciosamente.

## Vercel

Importe o repositório como Next.js, Node 24, build `npm run build`. Configure as variáveis de `.env.example` no escopo adequado. Migrations são aplicadas separadamente no Supabase antes de liberar usuários. Ajuste URLs de autenticação para o domínio final. Não há deploy ou contratação automática nesta entrega.

## Limites intencionais

A dívida no inventário não cria parcelas automaticamente: cadastre o compromisso no Planejar para impedir descontos duplicados, especialmente em folha. Empréstimos recebidos criam passivo com condições desconhecidas; complete o inventário antes de simular. Reembolsos sem gasto original podem ser informados e ficam explícitos. Recebimentos pagos de contrato podem ser revertidos excluindo o movimento vinculado.

Cartão é pagamento de fatura com detalhes informativos; não misture com despesas individuais já lançadas. O backup é exportável, não há restauração de JSON pela interface. Há lista cronológica de vencimentos, sem grade de calendário. Parcelamentos são mensais, sem índice de correção ou renegociação automática. Não há Open Finance, Pix real, OCR, chatbot, integração de transporte, investimentos, contas compartilhadas ou assinatura paga.

Veja [regras financeiras](docs/REGRAS_FINANCEIRAS.md), [progresso e evidências](docs/PROGRESSO.md) e [CSV fictício](examples/movimentos-ficticios.csv).

### Alternativa local leve (sem a imagem completa do CLI)

Neste ambiente, as imagens completas de PostgreSQL do CLI excederam o disco. Existe um runner descartável que usa as imagens oficiais GoTrue v2.197.0, PostgREST v16.5 e PostgreSQL 15 Alpine, com os mesmos endpoints `/auth/v1` e `/rest/v1`, RLS e migrations:

```sh
node scripts/local-backend.mjs
# em outro terminal, após a mensagem de disponibilidade:
npm run test:backend
CHROMIUM_PATH=/usr/bin/chromium npm run test:real
```

**Somente desenvolvimento/testes fictícios.** O runner recria exclusivamente `folga-auth-db`, `folga-auth` e `folga-rest`, na rede `folga-services`; não aponte para dados de usuário. PostgreSQL usa autenticação trust apenas nessa rede local de containers descartáveis, sem porta de banco publicada. As APIs ficam em loopback. `.local-backend.json` contém chaves locais efêmeras e é ignorado pelo Git. Não use essa composição como deploy de produção. Remova os containers após os testes (`docker rm -f folga-auth folga-rest folga-auth-db`) e apague `.local-backend.json` quando não forem mais necessários.

Para testar só migrations e políticas SQL sem autenticação HTTP: crie `folga-sql-test` com PostgreSQL 15 Alpine, sem rede e sem porta, e execute `bash scripts/test-sql.sh`. Esse script recria apenas o banco fictício `folga_test` e usa uma implementação local de `auth.uid()` para exercitar as políticas. Esse teste SQL sozinho não comprova login, recuperação por e-mail ou integração SSR.
