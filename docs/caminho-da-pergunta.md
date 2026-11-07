# O caminho de uma pergunta, da tela ao endpoint

## "Qual é o meu saldo?"

```
Cliente digita no chat
        │
        ▼
app.js          captura o texto e chama Engine.answer(pergunta)
        │
        ▼
engine.js       normaliza o texto (minúsculas, sem acento)
                e reconhece a intenção: "saldo"
        │
        ▼
Fonte           Plaid · /accounts/balance/get
(integração     campos: balances.available, balances.current,
 real)          balances.limit, account.type
        │        (neste app: o mesmo formato, lido de js/data.js)
        ▼
engine.js       soma balances.available das contas "depository";
                separa o cartão (crédito) como dívida
        │
        ▼
app.js          desenha a resposta e o bloco
                "Como cheguei nessa resposta"
```

Cada resposta do app traz, abaixo da bolha, o bloco **Como cheguei nessa resposta** com a intenção reconhecida, o endpoint equivalente, os dados usados e o cálculo.

## Por que o saldo do cartão aparece como dívida?

Em contas de crédito, a Plaid usa os campos de saldo com outro significado:

| Campo | Em conta corrente | Em cartão de crédito |
|---|---|---|
| `balances.current` | dinheiro na conta | **quanto você deve** (dívida) |
| `balances.limit` | não se aplica | limite total |
| `balances.available` | dinheiro que pode usar | **limite − dívida** |

Por isso o app mostra o cartão como "Dívida atual" e "Limite disponível", e **não** soma o cartão ao dinheiro líquido do cliente.

A regra de sinal nas transações vale para todas as contas: **positivo é saída** (compra), **negativo é entrada** (salário, pagamento recebido). Quando o cliente paga a fatura, o pagamento sai da conta corrente (positivo) e entra no cartão (negativo). Por isso o app **não conta pagamento de fatura como gasto**: a compra já foi contada quando passou no cartão.

## Mapa pergunta → endpoint

| Pergunta | Intenção | Endpoint da Plaid | Campos |
|---|---|---|---|
| Qual é o meu saldo? | `saldo` | `/accounts/balance/get` | `balances.*` |
| Minhas contas | `contas` | `/accounts/get` | `name`, `subtype`, `mask` |
| Me explique o cartão | `cartao` | `/accounts/balance/get` + `/transactions/get` | `current`, `limit`, `available` |
| Quanto gastei em outubro? | `gastos` | `/transactions/get` | `date`, `amount`, `personal_finance_category.primary` |
| Gastos por categoria / conta | `gastos` | `/transactions/get` | idem + `account_id` |
| Extrato, maior gasto | `extrato`, `maior` | `/transactions/get` | `date`, `name`, `amount` |
| Padrões de gasto | `padroes` | `/transactions/get` | `merchant_name`, `date`, `amount` |
| Posso pagar o pacote X? | `viagem` | saldos + transações + catálogo local | veja o README |
| O que é um Item? / MCP? | `fontes`, `mcp` | documentação (Pluggy via MCP) | resposta conceitual |
