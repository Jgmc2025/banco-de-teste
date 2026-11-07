# Especificação para o Lovable (Etapa 1: dados locais)

Esta é a especificação que descreve o app deste repositório, escrita para ser colada no Lovable. Ela segue a Etapa 1 do guia: chat no front-end, **dados locais fictícios**, nenhuma chave.

> **Como usar:** mande primeiro no **modo chat** do Lovable, para ele tirar dúvidas, e só depois peça a construção. Cole também o conteúdo de [`js/data.js`](../js/data.js) quando ele pedir os dados.
>
> **Observação:** o guia da aula traz a especificação oficial nas páginas 25 a 28. Esta é uma versão própria, no mesmo espírito. Se preferir usar a do guia, troque o que aparece desfocado pelo seu nome e pelo cenário "agência de viagem" descrito abaixo.

---

## Texto para colar

```text
# Assistente financeiro em chat, dentro de uma agência de viagem fictícia

## Contexto
Construa um web app de uma única página em português (pt-BR). O cliente está no site da agência fictícia "Rota Viva Viagens", escolhendo um pacote de viagem, e conversa com um assistente financeiro que responde sobre o banco dele para ajudar na decisão. Todos os dados são fictícios.

## Etapa 1 (esta): sem backend
- Dados locais em um arquivo (accounts, transactions) no formato da Plaid Sandbox.
- Nenhuma chave de API, nenhuma chamada externa, nenhum login.
- Regra da Plaid: em transactions, amount POSITIVO é saída (gasto) e NEGATIVO é entrada.
- Em conta de crédito, balances.current é a DÍVIDA e balances.available = limit - current.

## Avisos obrigatórios na tela (sempre visíveis)
1. "Dados fictícios" (selo no topo).
2. Faixa de aviso: contas, saldos e transações são inventados (formato Plaid Sandbox); não representa o Open Finance brasileiro; nunca digitar senha, código ou número de cartão.
3. Valores em US$ com conversão para R$ a taxa FIXA de demonstração (1 US$ = R$ 5,50), declarada na faixa de aviso.

## Interface
- Topo: nome "Rota Viva Viagens", subtítulo e o selo "Dados fictícios".
- Lista de mensagens (usuário à direita, assistente à esquerda), com aria-live.
- Respostas podem ter parágrafo, lista, tabela e nota.
- Abaixo de cada resposta do assistente, um bloco recolhível "Como cheguei nessa resposta" com: intenção reconhecida, endpoint equivalente da Plaid, dados usados e cálculo.
- Chips de sugestão de perguntas, que mudam conforme a resposta.
- Campo de texto + botão Enviar. Layout responsivo (mobile primeiro), modo claro e escuro, foco visível.
- Nunca renderizar o texto do usuário como HTML.

## O que o assistente responde (a partir dos dados locais)
1. Saldo e contas. O cartão aparece como DÍVIDA e como limite disponível, e não entra na soma do dinheiro líquido (corrente + poupança).
2. Por que o saldo do cartão aparece como dívida (explica current, limit, available).
3. Gastos por período (mês por nome, mês passado, este mês, últimos N dias), por categoria e por conta.
   - Não contar como gasto: INCOME, TRANSFER_IN, TRANSFER_OUT, LOAN_PAYMENTS (pagamento de fatura duplicaria a compra).
4. Extrato (8 mais recentes) e maior gasto.
5. Três padrões de gasto: categoria dominante, gastos recorrentes (mesmo estabelecimento em 2+ meses com valor até 15% diferente) e dia da semana (ex.: delivery todo sábado).
6. Simulação de pacote de viagem (Noronha R$ 6.900, Gramado R$ 3.200, Lisboa R$ 12.500, até 10x sem juros, valores de demonstração):
   - dinheiro líquido = saldo disponível da corrente + poupança
   - reserva = 1 mês de gastos médios dos meses fechados
   - disponível = líquido - reserva
   - sobra mensal = renda média - gasto médio
   - veredito: "cabe à vista com folga" (preço <= 70% do disponível), "cabe à vista, mas apertado" (<= 100%), "melhor parcelar" (cabe no limite do cartão e a parcela <= 50% da sobra mensal) ou "ainda não cabe" (com meses para juntar).
   - sempre terminar com a nota: simulação educativa, dados fictícios, não é recomendação financeira.
7. Conceitos: o que é um Item, o que é MCP, isto é Open Finance? (não: é só laboratório).

## Regras de conduta (como no prompt do assistente)
- Nunca inventar número. Se o dado não existe (ex.: período fora do intervalo 01/09/2026 a 06/11/2026), dizer que não encontrou.
- Pergunta fora do escopo: dizer que não encontrou e listar o que sabe responder.
- Se a pessoa digitar senha, token, código ou CPF: avisar para não enviar e não repetir o valor.
- Tom direto e cordial, respostas curtas.

## Perguntas para testar
- "Qual é o meu saldo?"
- "Por que o saldo do cartão aparece como dívida?"
- "Quanto gastei em outubro?" e depois "E em setembro?"
- "Gastos por categoria"
- "Quais são meus padrões de gasto?"
- "Posso pagar o pacote de Noronha?"
- "Quanto vale o bitcoin?" (deve admitir que não sabe)

## Etapa 2 (não fazer agora)
Backend com as chaves da Plaid só no servidor, trocando o arquivo de dados local por chamadas reais. O restante do app não muda.
```

---

## Ajustes depois do Lovable

Registre aqui o que você pediu para corrigir depois da primeira versão gerada (um item por ajuste, com o prompt usado). Exemplos do que costuma precisar de revisão:

- [ ] Conferir se o cartão aparece como dívida e fica fora da soma do dinheiro líquido
- [ ] Conferir se pagamento de fatura e transferências ficaram fora do "gasto"
- [ ] Conferir se o aviso de dados fictícios e a taxa de conversão estão visíveis
- [ ] Conferir que nenhuma chave, token ou senha entrou no código
