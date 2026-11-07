# Assistente financeiro em chat para uma agência de viagem

Um chat em português que responde sobre contas, saldos e transações de um **banco de teste** e ajuda o cliente a decidir se uma viagem cabe no bolso, **sem tirar o cliente do site da agência**.

> ⚠️ **Tudo aqui é fictício.** As contas, os saldos e as transações são inventados (formato Plaid Sandbox) e a "Rota Viva Viagens" não existe. O projeto **não** representa o Open Finance brasileiro, que em produção exige consentimento do cliente e segurança reforçada.

**App publicado:** `https://github.com/Jgmc2025/banco-de-teste.git`

---

## 1. Onde o cliente já está, o que o assistente responde e de onde vem cada dado

**Onde o cliente já está:** no site de uma agência de viagem, comparando pacotes. A decisão financeira acontece ali ("isso cabe no meu mês?"), então o banco vem até ele em vez de ele ir ao app do banco.

**O que o assistente responde:**

| Pergunta de exemplo | O que ele entrega | De onde vem o dado |
|---|---|---|
| "Qual é o meu saldo?" | Saldos das contas e dinheiro líquido (corrente + poupança) | `/accounts/balance/get` → `balances.*` |
| "Por que o saldo do cartão aparece como dívida?" | Explica `current`, `limit` e `available` | `/accounts/balance/get` |
| "Quanto gastei em outubro?" / "Gastos por categoria" / "Gastos por conta" | Total e quebra por categoria, período ou conta | `/transactions/get` → `amount`, `date`, `personal_finance_category` |
| "Extrato do cartão" / "Qual foi o meu maior gasto?" | Lançamentos mais recentes e maiores | `/transactions/get` |
| "Quais são meus padrões de gasto?" | Três padrões: categoria dominante, gastos recorrentes e dia da semana | `/transactions/get` → `merchant_name`, `date` |
| "Posso pagar o pacote de Noronha?" | À vista com folga, apertado, melhor parcelar ou ainda não cabe | saldos + transações + catálogo fictício de pacotes |
| "O que é um Item?" / "O que é MCP?" | Resumo conceitual | documentação da Pluggy (via MCP) |

Se a informação não existe nos dados (um mês fora do intervalo, uma cotação), o assistente **diz que não encontrou** em vez de estimar. Se a pessoa digita senha, token ou CPF, ele avisa para não enviar e não repete o valor.

**Regras dos dados (Plaid):** em `transactions`, valor **positivo é saída**. Em cartão de crédito, `balances.current` é a **dívida**. Salário, transferência entre contas e pagamento de fatura **não** contam como gasto (o pagamento duplicaria a compra já feita no cartão).

Cada resposta traz o bloco **"Como cheguei nessa resposta"** (intenção, endpoint equivalente, dados e cálculo). O caminho completo, da pergunta ao endpoint, está em [`docs/caminho-da-pergunta.md`](docs/caminho-da-pergunta.md).

## 2. Como configurar os servidores MCP da Pluggy e da Plaid

Resumo (passo a passo, erros comuns e segurança em [`docs/mcp-setup.md`](docs/mcp-setup.md)):

```toml
# ~/.codex/config.toml
[mcp_servers.pluggy]            # remoto, Streamable HTTP, sem chave
url = "https://mcp.pluggy.ai/mcp"

[mcp_servers.plaid]             # servidor local deste projeto, via STDIO
command = "py"
args = ["-3", "C:\\Users\\lilia\\OneDrive\\Documentos\\banco-de-teste\\scripts\\plaid_sandbox_mcp.py"]
env_vars = ["PLAID_CLIENT_ID", "PLAID_SECRET"]   # valores herdados do ambiente
```

1. **Pluggy:** adicione a URL, confira com `/mcp` e peça que a IA explique o que é um Item, com as fontes.
2. **Plaid:** configure `PLAID_CLIENT_ID` e `PLAID_SECRET` do ambiente Sandbox nas variáveis do usuário do Windows e acrescente o bloco acima em `C:\Users\lilia\.codex\config.toml`.
3. **Consulta:** use `plaid_create_sandbox_item` e passe o `item_id` retornado a `plaid_get_accounts`, `plaid_get_balances` e `plaid_get_transactions`. O access token nunca é mostrado e permanece apenas na memória do servidor.

Exemplos prontos e **sem chaves**: [`config/codex-config.example.toml`](config/codex-config.example.toml), [`config/mcp.example.json`](config/mcp.example.json) e [`.env.example`](.env.example).

## 3. A especificação enviada ao Lovable e o que foi ajustado

- A especificação (Etapa 1 do guia: dados locais, sem chave) está em [`docs/especificacao-lovable.md`](docs/especificacao-lovable.md).
- O prompt de sistema para uma futura versão com IA está em [`docs/prompt-do-assistente.md`](docs/prompt-do-assistente.md).
- **Ajustes depois do Lovable:** `PREENCHER` (liste aqui o que você corrigiu depois da primeira versão, na seção "Ajustes depois do Lovable" do arquivo de especificação).

Esta versão do repositório foi escrita diretamente em HTML, CSS e JavaScript puros, com o motor de respostas separado da interface e coberto por testes. Ela é a referência do que a especificação descreve.

## 4. Melhoria escolhida e endereço do app

**Melhorias:**

1. **Valores em reais, com a conversão declarada.** Os dados chegam em US$ (como a Plaid entrega) e a tela mostra o equivalente em R$ a uma taxa **fixa de demonstração** (1 US$ = R$ 5,50), declarada na faixa de aviso. Não é cotação real.
2. **Perguntas novas:** gasto por categoria, por período (mês, mês passado, últimos N dias) e por conta, com perguntas de continuação ("E em setembro?").

**Endereço do app publicado:** `https://github.com/Jgmc2025/banco-de-teste.git`

---

## Como rodar e testar

Requisitos: um navegador e, para os testes, Node.js 18 ou superior. Não há dependências para instalar.

```bash
# abrir o app localmente (qualquer servidor estático serve)
npm start                  # http://localhost:8080

# rodar os testes do motor (18 testes)
npm test

# regerar a conversa de exemplo
npm run exemplo
```

## Como a simulação de viagem decide

| Passo | Cálculo |
|---|---|
| Dinheiro líquido | saldo disponível da conta corrente + poupança (cartão fica de fora, é dívida) |
| Reserva | 1 mês de gastos médios dos meses fechados (setembro e outubro) |
| Disponível | líquido − reserva |
| Sobra mensal | renda média − gasto médio dos meses fechados |
| **Cabe à vista com folga** | preço ≤ 70% do disponível |
| **Cabe à vista, mas apertado** | preço ≤ 100% do disponível |
| **Melhor parcelar** | cabe no limite do cartão e a parcela (10x, sem juros de demonstração) ≤ 50% da sobra mensal |
| **Ainda não cabe** | caso contrário, com estimativa de meses para juntar |

É uma **simulação educativa**, sem juros e sem recomendação financeira.

## Estrutura

```
.
├── index.html                      página do chat
├── css/style.css                   visual (claro e escuro)
├── js/
│   ├── data.js                     dados FICTÍCIOS no formato Plaid Sandbox
│   ├── engine.js                   motor: pergunta → intenção → cálculo → resposta
│   └── app.js                      interface (só monta a tela)
├── test/engine.test.js             testes do motor
├── scripts/gerar-conversa-exemplo.js
├── config/                         exemplos de configuração de MCP, sem chaves
├── docs/
│   ├── mcp-setup.md                configuração dos servidores MCP
│   ├── especificacao-lovable.md    especificação para o Lovable
│   ├── prompt-do-assistente.md     prompt de sistema (versão com IA)
│   ├── caminho-da-pergunta.md      da pergunta ao endpoint
│   └── evidencias/                 conversa de exemplo e guia de prints
├── .env.example                    modelo das variáveis (sem valores)
└── .gitignore                      bloqueia .env, chaves e dependências
```

## Evidências

- Conversa de exemplo gerada pelo próprio motor: [`docs/evidencias/conversa-exemplo.md`](docs/evidencias/conversa-exemplo.md)
- Prints das tabelas na IA e da conversa no app publicado: veja o que adicionar em [`docs/evidencias/LEIAME.md`](docs/evidencias/LEIAME.md)

## Limites e segurança

- Dados 100% fictícios e locais. **Nenhuma chave, token ou senha** neste repositório.
- O texto digitado pelo usuário é sempre inserido como texto, nunca como HTML.
- Para usar a Plaid de verdade, as chaves ficam em um **backend** (Etapa 2 do guia), nunca no navegador.
- A Plaid Sandbox é laboratório. O Open Finance brasileiro em produção exige consentimento e segurança que este projeto não implementa.
