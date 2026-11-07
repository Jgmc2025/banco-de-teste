'use strict';
// Gera docs/evidencias/conversa-exemplo.md rodando o motor do assistente em perguntas fixas.
// Uso: npm run exemplo
const fs = require('node:fs');
const path = require('node:path');
const E = require('../js/engine.js');

const perguntas = [
  'Qual é o meu saldo?',
  'Por que o saldo do cartão aparece como dívida?',
  'Quanto gastei em outubro?',
  'Gastos por categoria',
  'Quais são meus padrões de gasto?',
  'Posso pagar o pacote de Noronha?',
  'Quanto vale o bitcoin?'
];

function bloco(b) {
  if (b.t === 'p') return b.text + '\n';
  if (b.t === 'note') return '> ' + b.text + '\n';
  if (b.t === 'list') return b.items.map((i) => '- ' + i).join('\n') + '\n';
  if (b.t === 'table') {
    const head = '| ' + b.headers.join(' | ') + ' |\n| ' + b.headers.map(() => '---').join(' | ') + ' |\n';
    return head + b.rows.map((r) => '| ' + r.join(' | ') + ' |').join('\n') + '\n';
  }
  return '';
}

let md = '# Conversa de exemplo\n\n';
md += 'Gerada automaticamente por `npm run exemplo`, rodando o motor do assistente (`js/engine.js`) sobre os dados fictícios (`js/data.js`).\n';
md += 'Não é um print: é a saída textual das mesmas respostas que o app mostra. Valores em US$ com conversão para R$ à taxa fixa de demonstração (1 US$ = R$ ' + E.RATE.toFixed(2).replace('.', ',') + ').\n\n';

const ctx = { lastIntent: null };
perguntas.forEach((q) => {
  const r = E.answer(q, ctx);
  ctx.lastIntent = r.intent;
  md += '---\n\n**Cliente:** ' + q + '\n\n**Assistente** _(intenção: ' + r.intent + ')_\n\n';
  md += r.blocks.map(bloco).join('\n') + '\n';
  if (r.sources && r.sources.length) md += '_Fonte equivalente: ' + r.sources.join(' · ') + '_\n\n';
});

const out = path.join(__dirname, '..', 'docs', 'evidencias', 'conversa-exemplo.md');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, md);
console.log('Gerado: ' + path.relative(process.cwd(), out));
