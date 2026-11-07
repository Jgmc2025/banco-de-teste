# Como configurar os servidores MCP (Pluggy e Plaid)

MCP (Model Context Protocol) é o padrão que liga a IA a fontes externas, como uma tomada padrão. Neste projeto são dois servidores:

| Servidor | Tipo | Para que serve aqui | Chave |
|---|---|---|---|
| **Pluggy** | Streamable HTTP (remoto) | A IA lê a documentação da integração bancária brasileira e explica conceitos, como o que é um Item | Não precisa |
| **Plaid** | STDIO (local, via `uvx`) | Cria um banco de teste (Sandbox) com dados fictícios | Client ID e secret de Sandbox |

> Os exemplos abaixo usam o **Codex**. Em outra IA o formato muda um pouco, mas a ideia é a mesma: URL para o Pluggy, comando para a Plaid. Há um exemplo em JSON em [`config/mcp.example.json`](../config/mcp.example.json).

## 1. Pluggy

Servidor remoto, sem chave. Em `~/.codex/config.toml`:

```toml
[mcp_servers.pluggy]
url = "https://mcp.pluggy.ai/mcp"
```

**Conferir:** no Codex, rode `/mcp` e veja se `pluggy` aparece conectado.

**Primeiro teste (peça com as fontes):**

> Explique o que é um Item na Pluggy e cite as fontes da documentação.

## 2. Plaid

### 2.1 Chaves de Sandbox

1. Entre no Dashboard da Plaid, em **Developers → Keys**.
2. Copie o **Client ID** e o **secret de Sandbox** (use sempre o de Sandbox, nunca o de produção).
3. Guarde no seu computador, fora do repositório. Este projeto traz [`.env.example`](../.env.example) como modelo e o `.gitignore` já bloqueia `.env`.

### 2.2 Instalar o uv

O servidor roda pelo `uvx`, que vem com o [uv](https://docs.astral.sh/uv/). Depois de instalar, confirme com `uvx --version` e descubra o caminho com `which uvx` (no Windows, `where uvx`). Se o app da IA não achar o comando sozinho, use o **caminho completo** no campo `command`.

### 2.3 Adicionar o servidor

Em `~/.codex/config.toml` (o arquivo completo de exemplo está em [`config/codex-config.example.toml`](../config/codex-config.example.toml)):

```toml
[mcp_servers.plaid]
command = "uvx"          # ou o caminho completo do uvx
args = ["mcp-server-plaid"]
env_vars = ["PLAID_CLIENT_ID", "PLAID_SECRET"]
```

Com `env_vars`, o Codex repassa as duas variáveis do seu ambiente, e o valor das chaves **não** fica gravado no arquivo. Exporte-as no terminal antes de abrir o Codex:

```bash
export PLAID_CLIENT_ID="..."   # seu Client ID de Sandbox
export PLAID_SECRET="..."      # seu secret de Sandbox
```

A alternativa é um bloco `[mcp_servers.plaid.env]` com os valores escritos no arquivo. Funciona, mas é mais arriscado, porque o arquivo pode ser copiado ou aparecer em print.

**Conferir:** `/mcp` deve listar `plaid`. O servidor expõe quatro ferramentas: `search_documentation`, `get_mock_data_prompt`, `get_sandbox_access_token` e `simulate_webhook`.

## 3. Consultar o banco fictício

1. Peça um **Item de teste** (a ferramenta `get_sandbox_access_token` cria a conexão de Sandbox e devolve o token).
2. Com o token, peça à IA para ler **contas, saldos e transações** pelos endpoints da Plaid (`/accounts/get`, `/accounts/balance/get`, `/transactions/get`). O guia da aula mostra como o Codex faz essa parte.
3. Peça **tabelas com três padrões de gasto**. Este projeto mostra um exemplo do resultado na pergunta "Quais são meus padrões de gasto?" (veja [`docs/evidencias/conversa-exemplo.md`](evidencias/conversa-exemplo.md)).

**Regra de sinal da Plaid:** valor **positivo** é **saída** (gasto) e valor **negativo** é entrada. Em conta de crédito, `balances.current` é a **dívida**.

## 4. Erros comuns

| Sintoma | Causa provável | O que fazer |
|---|---|---|
| `plaid` não aparece em `/mcp` | O app não achou o `uvx` | Use o caminho completo no `command` e reinicie o Codex |
| Servidor sobe e cai | Variáveis de ambiente vazias | Exporte `PLAID_CLIENT_ID` e `PLAID_SECRET` **antes** de abrir o Codex |
| Erro de credencial | Chave de produção ou secret trocado | Use as chaves de **Sandbox** da página Keys |
| Saldo do cartão "negativo" | É dívida, não erro | Veja `balances.current` e `limit` |

## 5. Segurança

- Chave, token e senha **nunca** vão para o repositório, para o README ou para print.
- O site publicado deste projeto **não** usa as chaves: ele lê dados locais. Para ligar a Plaid de verdade, as chaves ficam num **backend** (Etapa 2 do guia), nunca no navegador.
- A Plaid Sandbox é só laboratório e **não** representa o Open Finance brasileiro, que em produção exige consentimento e segurança.
