#!/usr/bin/env python3
"""Minimal local MCP server for Plaid Sandbox. Tokens remain process-local."""

import json
import os
import re
import sys
import urllib.error
import urllib.request
import uuid
from datetime import date, timedelta

API = "https://sandbox.plaid.com"
ITEMS = {}


def plaid(path, payload):
    client_id = os.environ.get("PLAID_CLIENT_ID")
    secret = os.environ.get("PLAID_SECRET")
    if not client_id or not secret:
        raise ValueError("Defina PLAID_CLIENT_ID e PLAID_SECRET no ambiente.")
    body = {**payload, "client_id": client_id, "secret": secret}
    request = urllib.request.Request(
        API + path, data=json.dumps(body).encode(),
        headers={"Content-Type": "application/json"}, method="POST")
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            return json.loads(response.read().decode())
    except urllib.error.HTTPError as exc:
        try:
            detail = json.loads(exc.read().decode())
            message = detail.get("error_message", "Erro da Plaid Sandbox")
            code = detail.get("error_code", "")
        except Exception:
            message, code = "Erro da Plaid Sandbox", ""
        raise ValueError(f"{code}: {message}".strip(": ")) from None
    except urllib.error.URLError:
        raise ValueError("Não foi possível conectar à Plaid Sandbox.") from None


def create_item(args):
    institution = args.get("institution_id", "ins_109508")
    products = args.get("products", ["transactions"])
    if not isinstance(products, list) or not products or any(p not in ("transactions", "auth", "identity", "investments", "liabilities") for p in products):
        raise ValueError("products deve conter produtos Plaid Sandbox válidos.")
    result = plaid("/sandbox/public_token/create", {
        "institution_id": institution, "initial_products": products,
        "options": {"override_username": "user_good", "override_password": "pass_good"},
    })
    exchanged = plaid("/item/public_token/exchange", {"public_token": result["public_token"]})
    item_id = str(uuid.uuid4())
    ITEMS[item_id] = exchanged["access_token"]
    return {"item_id": item_id, "institution_id": institution,
            "products": products, "message": "Item Sandbox criado. Token mantido apenas na memória do servidor."}


def item_token(args):
    item_id = args.get("item_id", "")
    if item_id not in ITEMS:
        raise ValueError("item_id desconhecido. Crie um Item nesta sessão do servidor.")
    return ITEMS[item_id]


def accounts(args):
    token = item_token(args)
    result = plaid("/accounts/get", {"access_token": token})
    return {"accounts": result.get("accounts", [])}


def balances(args):
    token = item_token(args)
    result = plaid("/accounts/balance/get", {"access_token": token})
    return {"accounts": result.get("accounts", [])}


def transactions(args):
    token = item_token(args)
    end = args.get("end_date", date.today().isoformat())
    start = args.get("start_date", (date.fromisoformat(end) - timedelta(days=30)).isoformat())
    date.fromisoformat(start)
    date.fromisoformat(end)
    if start > end:
        raise ValueError("start_date deve ser anterior ou igual a end_date.")
    result = plaid("/transactions/get", {"access_token": token,
        "start_date": start, "end_date": end, "options": {"count": 100, "offset": 0}})
    return {"transactions": result.get("transactions", []),
            "total_transactions": result.get("total_transactions", 0),
            "date_range": {"start_date": start, "end_date": end}}


TOOLS = [
    {"name": "plaid_create_sandbox_item", "description": "Cria Item fictício na Plaid Sandbox e retorna item_id opaco (nunca um token).",
     "inputSchema": {"type": "object", "properties": {
         "institution_id": {"type": "string", "default": "ins_109508"},
         "products": {"type": "array", "items": {"type": "string"}, "default": ["transactions"]}}}},
    {"name": "plaid_get_accounts", "description": "Consulta as contas de um Item Sandbox.", "inputSchema": {"type": "object", "properties": {"item_id": {"type": "string"}}, "required": ["item_id"]}},
    {"name": "plaid_get_balances", "description": "Consulta os saldos atuais de um Item Sandbox.", "inputSchema": {"type": "object", "properties": {"item_id": {"type": "string"}}, "required": ["item_id"]}},
    {"name": "plaid_get_transactions", "description": "Consulta transações de um Item Sandbox (padrão: últimos 30 dias).",
     "inputSchema": {"type": "object", "properties": {"item_id": {"type": "string"}, "start_date": {"type": "string", "description": "YYYY-MM-DD"}, "end_date": {"type": "string", "description": "YYYY-MM-DD"}}, "required": ["item_id"]}},
]
HANDLERS = {"plaid_create_sandbox_item": create_item, "plaid_get_accounts": accounts,
            "plaid_get_balances": balances, "plaid_get_transactions": transactions}


def respond(message):
    if "id" not in message:
        return
    method, params = message.get("method"), message.get("params", {})
    result = None
    error = None
    if method == "initialize":
        result = {"protocolVersion": params.get("protocolVersion", "2024-11-05"),
                  "capabilities": {"tools": {"listChanged": False}},
                  "serverInfo": {"name": "plaid-sandbox-local", "version": "1.0.0"}}
    elif method == "ping":
        result = {}
    elif method == "tools/list":
        result = {"tools": TOOLS}
    elif method == "tools/call":
        name = params.get("name")
        try:
            if name not in HANDLERS:
                raise ValueError("Ferramenta desconhecida.")
            value = HANDLERS[name](params.get("arguments") or {})
            result = {"content": [{"type": "text", "text": json.dumps(value, ensure_ascii=False)}], "isError": False}
        except Exception as exc:
            # Do not include request payloads or token values in errors.
            message = str(exc)
            for token in list(ITEMS.values()) + [os.environ.get("PLAID_SECRET", "")]:
                if token:
                    message = message.replace(token, "[redacted]")
            message = re.sub(r"(?:access|public|link)-sandbox-[A-Za-z0-9-]+", "[redacted]", message)
            result = {"content": [{"type": "text", "text": message}], "isError": True}
    else:
        error = {"code": -32601, "message": "Method not found"}
    reply = {"jsonrpc": "2.0", "id": message["id"]}
    reply["result" if error is None else "error"] = result if error is None else error
    sys.stdout.write(json.dumps(reply, ensure_ascii=False) + "\n")
    sys.stdout.flush()


for line in sys.stdin:
    try:
        respond(json.loads(line))
    except Exception:
        # Keep stdout reserved for protocol frames; malformed input gets no secret-bearing diagnostics.
        continue
