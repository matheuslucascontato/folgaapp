# Regras e convenções financeiras

## Representação

Dinheiro em centavos inteiros seguros; parser brasileiro usa Decimal para transformar texto. Não usamos floats decimais para somar dinheiro. PostgreSQL guarda BIGINT. Juros percentuais mensais são strings decimais no domínio, NUMERIC no banco, calculados com decimal.js. Ausência é null; zero informado é zero. CET anual é outro campo, sem conversão para amortização.

Datas financeiras ISO sem horário são validadas e projetadas em colunas DATE; apresentação dd/mm/aaaa. Hoje é determinado em America/Sao_Paulo. Auditoria usa timestamptz UTC. Avanço mensal parte sempre da data original: 31/01 → 28/02 → 31/03, sem deslocar o dia âncora. Ano bissexto respeitado.

## Caixa e análises

Saldo por conta = abertura + movimentos realizados entre a data de abertura e hoje. Histórico anterior à abertura não altera esse saldo. Arquivar preserva histórico e saldo. Reservas segregadas ficam fora do disponível, mas aparecem separadas.

Receitas de trabalho usam apenas tipo income; empréstimo é caixa e cria passivo com taxa desconhecida. Transferências têm duas pernas, iguais em valor/data/status e contas diferentes. Não compõem receitas/despesas consolidadas. Exclusão remove ambas. Ajuste positivo/negativo é explícito e não é receita ou despesa.

Despesa bruta soma saídas expense; despesa líquida retira refund, preservando a data real do estorno. Detalhes de fatura não entram na soma: apenas o pagamento é saída. A soma dos detalhes não pode ultrapassar a fatura.

Salário deve estar líquido. O formulário pede confirmação quando descrito como salário. Compromissos em folha já abatidos não geram saída adicional; inventário e simulação continuam a acompanhá-los.

## Folga

1. Começa no saldo realizado disponível de hoje. Esse saldo inicial participa do mínimo.
2. Seleciona eventos até o horizonte. Sugestão: próxima entrada confirmada; sem ela, fim do mês. É possível ajustar o horizonte.
3. Soma entradas futuras confirmadas, recebimentos programados de contratos e retira compromissos abertos. Obrigações vencidas abertas são imediatas. Previsão nunca é gravada como dinheiro realizado.
4. Eventos são ordenados por dia e saídas antes de entradas quando horário desconhecido. Nos dias sem evento o saldo permanece igual.
5. Folga = menor saldo intermediário − reserva mínima adicional. Reserva segregada não é descontada novamente.
6. Negativo é falta para cobrir o período, mesmo com saldo final positivo. Positivo é estimativa, não garantia.

Renda provável entra apenas em cenário alternativo. Cadastro inicial incompleto, ausência de contas ou de próxima entrada confirmada produzem pendências específicas. O sistema não conhece obrigações que a pessoa ainda não informou.

## Compromissos e contratos

Chave de ocorrência é regra + vencimento. Geração percorre até 12 meses futuros e mantém atrasados abertos; pode repetir sem duplicar. Pagamento vincula um único movimento, com trava local, revisão otimista e índice único no banco. Desfazer reabre e remove esse movimento. Edição futura preserva pagamentos; editar uma ocorrência paga requer desfazer antes.

Fim de parcela libera o valor a partir do mês seguinte como redução de compromissos. Não cria receita. Datas finais e número de parcelas limitam geração.

Contrato separa valor/competência do cronograma de caixa. R$ 3.600 em três meses com recebimentos 2.600 / 1.000 / 0 não vira depósito mensal de 1.200. Cada recebimento marcado realizado cria/vincula um único movimento; repetição não duplica. Média mensal é somente informativa, sem efeito no caixa.

Atividade é soma de receitas vinculadas menos despesas vinculadas; nenhuma taxa de plataforma é presumida. Repasse já líquido não sofre novo desconto. Sem confirmação dos custos completos, não chamamos o resultado de lucro líquido. Um mês não cria recorrência garantida.

## Simulação

Subconjunto selecionado, sem alterar contratos reais. Exclui taxa ausente, atraso sem atualização, saldo não positivo e parcela não informada. Orçamento total constante = mínimos selecionados + extra. Juros incidem no saldo de cada dívida no começo do mês; arredondamento HALF_UP para centavos. Paga mínimos limitados pelo saldo do mês. Aplica extra/sobras no alvo e reaplica quitações no mesmo mês. Bola de neve ordena menor saldo e avalanche maior taxa mensal conhecida. Limite 600 meses; amortização negativa, inconsistência de prazo/parcela e limite numérico geram alerta, sem promessa de data inviável.

O orçamento inclui dívidas em folha apenas dentro da simulação, sem duplicar saídas no painel. O extra é cenário escolhido. Folga negativa/incompleta ou extra acima da folga não comprovam capacidade de pagamento. Estimativa de juros não é economia mensal confirmada.

## Auditoria e importação

Regras locais explicam evidência e certeza: assinatura explicitamente cadastrada; mesmo valor/descrição em meses distintos; pagamentos parecidos; encerramentos; finalidade pendente; custos ausentes; vencimentos antes da entrada. Repetição não prova assinatura ou duplicidade. Uso ou falta de uso nunca é inferido.

Tarefas têm prazo/status. Confirmar economia exige declaração de recorrência mensal, valor e data de efeito. Economia não altera automaticamente projeções de caixa; é necessário atualizar o compromisso efetivo.

CSV tem prévia sem gravação, mapeamento, erros por linha e possíveis duplicatas por conta/data/valor/tipo/descrição normalizada. Hash do arquivo por conta exige escolha explícita ao repetir. Confirmação do agregado é transacional, chave do lote impede repetição da operação; falha desfaz tudo. Desfazer lote remove seus movimentos e limpa vínculos de estorno, ocorrência, recebimento e detalhes informativos. Exportações textuais neutralizam prefixos de fórmula e escapam aspas.
