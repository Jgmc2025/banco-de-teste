# Conversa de exemplo

Gerada automaticamente por `npm run exemplo`, rodando o motor do assistente (`js/engine.js`) sobre os dados fictícios (`js/data.js`).
Não é um print: é a saída textual das mesmas respostas que o app mostra. Valores em US$ com conversão para R$ à taxa fixa de demonstração (1 US$ = R$ 5,50).

---

**Cliente:** Qual é o meu saldo?

**Assistente** _(intenção: saldo)_

Seu dinheiro hoje: US$ 3,570.55 (≈ R$ 19.638,03) somando conta corrente e poupança.

| Conta | O que é | Valor |
| --- | --- | --- |
| Conta Corrente | Saldo disponível | US$ 1,420.55 (≈ R$ 7.813,03) |
| Poupança Viagem | Saldo disponível | US$ 2,150.00 (≈ R$ 11.825,00) |
| Cartão de Crédito | Dívida atual (o que você deve) | US$ 1,245.30 (≈ R$ 6.849,15) |
| Cartão de Crédito | Limite disponível (de US$ 5,000.00) | US$ 3,754.70 (≈ R$ 20.650,85) |

> No cartão de crédito o valor é dívida, não dinheiro seu. Por isso ele não entra na soma.

_Fonte equivalente: Plaid · /accounts/balance/get_

---

**Cliente:** Por que o saldo do cartão aparece como dívida?

**Assistente** _(intenção: cartao_divida)_

Porque, em contas de crédito, a Plaid usa o campo balances.current para o quanto você DEVE, não para o que você tem.

- Dívida atual (current): US$ 1,245.30 (≈ R$ 6.849,15)
- Limite (limit): US$ 5,000.00
- Disponível (available): US$ 3,754.70, que é o limite menos a dívida

> Compra no cartão é valor positivo (saída) e pagamento da fatura é valor negativo (entrada), a mesma regra das contas comuns.

_Fonte equivalente: Plaid · /accounts/balance/get (campos balances.current, limit e available)_

---

**Cliente:** Quanto gastei em outubro?

**Assistente** _(intenção: gastos)_

Você gastou US$ 2,138.23 (≈ R$ 11.760,27) em outubro de 2026, em 17 lançamentos.

| Categoria | Total (US$) | Em reais (≈) | % do total |
| --- | --- | --- | --- |
| Moradia e contas | US$ 1,412.65 | R$ 7.769,58 | 66% |
| Alimentação | US$ 540.95 | R$ 2.975,23 | 25% |
| Lazer e assinaturas | US$ 53.98 | R$ 296,89 | 3% |
| Bem-estar | US$ 49.90 | R$ 274,45 | 2% |
| Transporte | US$ 44.35 | R$ 243,93 | 2% |

> Mostrando as 5 maiores categorias de 6. Peça "gastos por categoria" para ver todas.

> Não conto como gasto: salário, transferências entre contas e pagamento de fatura (a compra já foi contada quando passou no cartão).

_Fonte equivalente: Plaid · /transactions/get (ou /transactions/sync)_

---

**Cliente:** Gastos por categoria

**Assistente** _(intenção: gastos)_

Você gastou US$ 5,802.01 (≈ R$ 31.911,06) em todo o período dos dados (01/09/2026 a 06/11/2026), em 38 lançamentos.

| Categoria | Total (US$) | Em reais (≈) | % do total |
| --- | --- | --- | --- |
| Moradia e contas | US$ 4,040.75 | R$ 22.224,13 | 70% |
| Alimentação | US$ 1,252.35 | R$ 6.887,93 | 22% |
| Bem-estar | US$ 149.70 | R$ 823,35 | 3% |
| Transporte | US$ 106.15 | R$ 583,83 | 2% |
| Lazer e assinaturas | US$ 103.96 | R$ 571,78 | 2% |
| Compras | US$ 89.90 | R$ 494,45 | 2% |
| Saúde | US$ 59.20 | R$ 325,60 | 1% |

> Não conto como gasto: salário, transferências entre contas e pagamento de fatura (a compra já foi contada quando passou no cartão).

_Fonte equivalente: Plaid · /transactions/get (ou /transactions/sync)_

---

**Cliente:** Quais são meus padrões de gasto?

**Assistente** _(intenção: padroes)_

Três padrões nos seus gastos de todo o período dos dados (01/09/2026 a 06/11/2026):

- Peso por categoria: "Moradia e contas" lidera com US$ 4,040.75 (70% dos gastos), seguida de "Alimentação" (22%).
- Gastos que se repetem todo mês: 6 estabelecimentos, somando cerca de US$ 1,496.26 (≈ R$ 8.229,43) por mês (tabela abaixo).
- Dia da semana: "Mercado Bom Preço": 5 de 5 compras caíram aos domingos, com média de US$ 169.65. "Delivery FoodGo": 8 de 8 compras caíram aos sábados, com média de US$ 43.26. "App Move": 5 de 5 compras caíram às quartas-feiras, com média de US$ 21.23. No total, 45% do gasto cai no fim de semana.

| Gasto recorrente | Meses | Média por mês |
| --- | --- | --- |
| Imobiliária Sol | 3 | US$ 1,200.00 |
| Companhia de Energia | 2 | US$ 140.48 |
| Internet Fibra Net | 2 | US$ 79.90 |
| Academia Forma | 3 | US$ 49.90 |
| Streaming Max | 2 | US$ 15.99 |
| Música Plus | 2 | US$ 9.99 |

> Recorrente = mesmo estabelecimento em 2 ou mais meses, com valores até 15% diferentes entre si.

_Fonte equivalente: Plaid · /transactions/get (ou /transactions/sync)_

---

**Cliente:** Posso pagar o pacote de Noronha?

**Assistente** _(intenção: viagem)_

Fernando de Noronha · 5 dias custa R$ 6.900,00 (≈ US$ 1,254.55).

| Sua situação | Valor |
| --- | --- |
| Dinheiro líquido (corrente + poupança) | US$ 3,570.55 (≈ R$ 19.638,03) |
| Reserva de segurança (1 mês de gastos médios) | US$ 2,142.26 (≈ R$ 11.782,43) |
| Disponível para a viagem | US$ 1,428.29 (≈ R$ 7.855,60) |
| Sobra mensal média (renda − gastos) | US$ 1,057.74 (≈ R$ 5.817,57) |
| Limite disponível no cartão | US$ 3,754.70 (≈ R$ 20.650,85) |

Cabe à vista, mas apertado: sobrariam só US$ 173.74 (≈ R$ 955,57) além da reserva. Parcelar em 10x de US$ 125.46 (≈ R$ 690,03) deixa o caixa mais folgado.

> Simulação educativa com dados fictícios. Considera parcelas sem juros (condição de demonstração) e não é recomendação financeira.

_Fonte equivalente: Plaid · /accounts/balance/get · Plaid · /transactions/get · Catálogo fictício de pacotes (js/data.js)_

---

**Cliente:** Quanto vale o bitcoin?

**Assistente** _(intenção: fallback)_

Não encontrei isso nos dados de demonstração e prefiro não chutar.

Posso responder sobre saldos, contas, cartão, gastos (por categoria, período ou conta), extrato, padrões de gasto e simulação de pacotes de viagem.

