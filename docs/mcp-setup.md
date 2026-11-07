# Servidor MCP local da Plaid Sandbox

Este projeto inclui `scripts/plaid_sandbox_mcp.py`, um servidor MCP local via STDIO que conversa diretamente com a Plaid Sandbox. Requer Python 3 e não usa dependências externas. As chaves são lidas exclusivamente de `PLAID_CLIENT_ID` e `PLAID_SECRET` no ambiente.

## Configurar no Windows

1. No PowerShell, defina as variáveis do ambiente do usuário com as credenciais de **Sandbox** obtidas em Plaid Dashboard → Developers → Keys (substitua os valores localmente; não os inclua em arquivos do projeto):

   ```powershell
   [Environment]::SetEnvironmentVariable('PLAID_CLIENT_ID', '<seu client id de Sandbox>', 'User')
   [Environment]::SetEnvironmentVariable('PLAID_SECRET', '<seu secret de Sandbox>', 'User')
   ```

2. Feche e reabra o Codex para que o processo herde as variáveis.
3. Abra `C:\Users\lilia\.codex\config.toml` e acrescente o bloco abaixo. Preserve outros servidores já configurados. Ajuste o caminho do script se o projeto estiver em outro local:

   ```toml
   [mcp_servers.plaid]
   command = "py"
   args = ["-3", "C:\\Users\\lilia\\OneDrive\\Documentos\\banco-de-teste\\scripts\\plaid_sandbox_mcp.py"]
   env_vars = ["PLAID_CLIENT_ID", "PLAID_SECRET"]
   ```

   Uma cópia desse bloco sem credenciais está em [`config/codex-config.example.toml`](../config/codex-config.example.toml). `env_vars` repassa os nomes do ambiente, sem gravar os valores no TOML. Nunca coloque credenciais em `env` ou no repositório.
4. Reinicie o Codex e confira `/mcp` para verificar se `plaid` está conectado.

## Ferramentas disponíveis

- `plaid_create_sandbox_item`: cria um Item Sandbox (por padrão `ins_109508`, produto `transactions`) e devolve um `item_id` opaco.
- `plaid_get_accounts`: lista contas do Item.
- `plaid_get_balances`: consulta saldos atuais.
- `plaid_get_transactions`: consulta transações; padrão últimos 30 dias, com `start_date` e `end_date` opcionais no formato `YYYY-MM-DD`.

Passe o `item_id` devolvido ao criar o Item nas outras ferramentas. Os Items e seus access tokens existem apenas na memória do processo; ao reiniciar o servidor, crie outro Item. O access token nunca é retornado por ferramenta. A criação usa `/sandbox/public_token/create` e troca o public token por um access token internamente, fluxo documentado pela Plaid [para Sandbox](https://plaid.com/docs/api/sandbox/).

Os dados são fictícios e a Plaid Sandbox serve apenas para desenvolvimento. Valor positivo em transações indica saída; `balances.current` de cartão de crédito representa dívida.

## Diagnóstico

- `py` não encontrado: instale Python 3 pelo instalador oficial e habilite o launcher `py`, ou substitua `command` por um caminho completo para `python.exe`.
- Credenciais ausentes: defina as variáveis no escopo `User`, encerre todos os processos do Codex e abra-o de novo.
- Erro de autenticação: confirme que ambas as chaves são do ambiente Sandbox.
- Depois de reiniciar o servidor, crie um novo Item para obter outro `item_id` válido.
