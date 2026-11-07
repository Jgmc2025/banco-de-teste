'use strict';
// Rode com: npm test   (usa o test runner nativo do Node 18+, sem dependências)
const test = require('node:test');
const assert = require('node:assert/strict');

const DADOS = require('../js/data.js');
const E = require('../js/engine.js');

function textOf(res) {
  return res.blocks
    .map((b) => {
      if (b.t === 'table') return b.headers.join(' ') + ' ' + b.rows.map((r) => r.join(' ')).join(' ');
      if (b.t === 'list') return b.items.join(' ');
      return b.text;
    })
    .join('\n');
}

// Soma independente, escrita aqui de propósito para não depender do motor.
function spendIn(from, to, account) {
  const skip = new Set(['INCOME', 'TRANSFER_IN', 'TRANSFER_OUT', 'LOAN_PAYMENTS']);
  let t = 0;
  for (const x of DADOS.transactions) {
    if (x.date < from || x.date > to) continue;
    if (account && x.account_id !== account) continue;
    if (x.amount > 0 && !skip.has(x.personal_finance_category.primary)) t += x.amount;
  }
  return Math.round(t * 100) / 100;
}

test('os dados são marcados como fictícios e têm o formato Plaid', () => {
  assert.equal(DADOS.ficticio, true);
  assert.ok(DADOS.accounts.length >= 3);
  const credit = DADOS.accounts.find((a) => a.type === 'credit');
  // available = limit - current
  assert.equal(Math.round((credit.balances.limit - credit.balances.current) * 100) / 100, credit.balances.available);
  for (const t of DADOS.transactions) {
    assert.ok(t.transaction_id && t.account_id && t.date && typeof t.amount === 'number');
  }
});

test('"Qual é o meu saldo?" mostra os saldos reais dos dados', () => {
  const r = E.answer('Qual é o meu saldo?');
  assert.equal(r.intent, 'saldo');
  const txt = textOf(r);
  assert.match(txt, /1,420\.55/);
  assert.match(txt, /2,150\.00/);
  assert.match(txt, /dívida/i);
});

test('gasto de outubro bate com a soma independente', () => {
  const r = E.answer('Quanto gastei em outubro?');
  assert.equal(r.intent, 'gastos');
  const esperado = spendIn('2026-10-01', '2026-10-31');
  assert.ok(textOf(r).includes(E.usd(esperado)), 'esperava ' + E.usd(esperado));
});

test('gasto no cartão em outubro filtra por conta', () => {
  const r = E.answer('Quanto gastei no cartão em outubro?');
  const esperado = spendIn('2026-10-01', '2026-10-31', 'acc_credit');
  assert.ok(textOf(r).includes(E.usd(esperado)));
});

test('categorias somam o total (sem perder nem duplicar lançamentos)', () => {
  const spend = E.spendTx(E.filterTx({ from: '2026-09-01', to: '2026-11-07' }, null));
  const cats = E.byCategory(spend);
  const soma = Math.round(cats.reduce((s, c) => s + c.total, 0) * 100) / 100;
  assert.equal(soma, spendIn('2026-09-01', '2026-11-07'));
});

test('pagamento de fatura, transferência e salário não contam como gasto', () => {
  const spend = E.spendTx(DADOS.transactions);
  for (const t of spend) {
    assert.ok(!['INCOME', 'TRANSFER_IN', 'TRANSFER_OUT', 'LOAN_PAYMENTS'].includes(t.personal_finance_category.primary));
    assert.ok(t.amount > 0);
  }
});

test('período sem dados: diz que não tem, não inventa', () => {
  const r = E.answer('Quanto gastei em janeiro?');
  assert.match(textOf(r), /Não encontrei/);
  assert.doesNotMatch(textOf(r), /US\$ \d/);
});

test('explica por que o cartão aparece como dívida', () => {
  const r = E.answer('Por que o saldo do cartão aparece como dívida?');
  assert.equal(r.intent, 'cartao_divida');
  assert.match(textOf(r), /balances\.current/);
  assert.match(textOf(r), /1,245\.30/);
});

test('padrões: acha os fixos, o delivery de sábado e o fim de semana', () => {
  const r = E.answer('Quais são meus padrões de gasto?');
  assert.equal(r.intent, 'padroes');
  const txt = textOf(r);
  assert.match(txt, /Imobiliária Sol/);
  assert.match(txt, /Delivery FoodGo/);
  assert.match(txt, /aos sábados/);
  assert.match(txt, /fim de semana/);
});

test('simulação de viagem: veredito muda conforme o preço', () => {
  const por = (id) => DADOS.pacotes.find((p) => p.id === id);
  assert.equal(E.simulate(por('gramado')).code, 'folga');
  assert.equal(E.simulate(por('noronha')).code, 'apertado');
  assert.equal(E.simulate(por('lisboa')).code, 'parcelar');
  // um pacote impossível cai em "não cabe"
  const caro = { preco_brl: 90000, parcelas_max: 10 };
  assert.equal(E.simulate(caro).code, 'nao_cabe');
});

test('conversão para reais usa a taxa declarada', () => {
  assert.equal(E.RATE, 5.5);
  assert.equal(E.brl(100), 'R$ 550,00');
  assert.equal(E.usd(1420.55), 'US$ 1,420.55');
});

test('pergunta com dado sensível não é respondida com o conteúdo e avisa', () => {
  const r = E.answer('minha senha é 1234, qual meu saldo?');
  assert.equal(r.intent, 'sensivel');
  assert.doesNotMatch(textOf(r), /1234/);
});

test('pergunta fora do escopo cai no fallback sem inventar valor', () => {
  const r = E.answer('Qual a cotação do bitcoin?');
  assert.equal(r.intent, 'fallback');
  assert.match(textOf(r), /prefiro não chutar/);
  assert.doesNotMatch(textOf(r), /US\$ \d/);
});

test('pergunta de continuação reaproveita a intenção anterior', () => {
  const r = E.answer('E em setembro?', { lastIntent: 'gastos' });
  assert.equal(r.intent, 'gastos');
  assert.ok(textOf(r).includes(E.usd(spendIn('2026-09-01', '2026-09-30'))));
});

test('"gastei com viagem" sem categoria Viagens avisa e não vira simulação', () => {
  const r = E.answer('Quanto gastei com viagem?');
  assert.equal(r.intent, 'gastos');
  assert.match(textOf(r), /categoria Viagens/);
});

test('extrato mostra sinais do ponto de vista do cliente', () => {
  const r = E.answer('Mostre meu extrato da conta corrente');
  assert.equal(r.intent, 'extrato');
  assert.match(textOf(r), /\+US\$ 3,200\.00|−US\$/);
});

test('conceitos: Item, MCP e Open Finance têm resposta própria', () => {
  assert.equal(E.answer('O que é um Item?').intent, 'fontes');
  assert.equal(E.answer('O que é MCP?').intent, 'mcp');
  assert.equal(E.answer('Isso é Open Finance?').intent, 'openfinance');
});

test('toda resposta tem blocos, sugestões e a intenção', () => {
  const perguntas = ['oi', 'saldo', 'contas', 'cartão', 'gastos por categoria', 'maior gasto', 'renda', 'posso viajar?', 'qualquer coisa estranha'];
  for (const q of perguntas) {
    const r = E.answer(q);
    assert.ok(Array.isArray(r.blocks) && r.blocks.length > 0, q);
    assert.ok(Array.isArray(r.suggestions) && r.suggestions.length > 0, q);
    assert.ok(typeof r.intent === 'string', q);
  }
});
