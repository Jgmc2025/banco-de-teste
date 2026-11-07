/*
 * Interface do chat. Só monta a tela: toda a lógica de resposta está em engine.js.
 * Texto de resposta entra sempre via textContent (nunca innerHTML) para não
 * executar nada digitado pelo usuário.
 */
(function () {
  'use strict';

  var log = document.getElementById('log');
  var form = document.getElementById('form');
  var input = document.getElementById('mensagem');
  var chips = document.getElementById('sugestoes');
  var taxa = document.getElementById('taxa');

  var ctx = { lastIntent: null };
  var INICIAIS = ['Qual é o meu saldo?', 'Quanto gastei em outubro?', 'Quais são meus padrões de gasto?', 'Posso pagar o pacote de Noronha?'];

  if (taxa && window.Engine) {
    taxa.textContent = '1 US$ = R$ ' + window.Engine.RATE.toFixed(2).replace('.', ',');
  }

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function scrollDown() {
    log.scrollTop = log.scrollHeight;
  }

  function renderBlocks(container, blocks) {
    blocks.forEach(function (b) {
      if (b.t === 'p') {
        container.appendChild(el('p', null, b.text));
      } else if (b.t === 'note') {
        container.appendChild(el('p', 'nota', b.text));
      } else if (b.t === 'list') {
        var ul = el('ul');
        b.items.forEach(function (i) { ul.appendChild(el('li', null, i)); });
        container.appendChild(ul);
      } else if (b.t === 'table') {
        var wrap = el('div', 'tabela-wrap');
        var table = el('table');
        var thead = el('thead');
        var tr = el('tr');
        b.headers.forEach(function (h) {
          var th = el('th', null, h);
          th.scope = 'col';
          tr.appendChild(th);
        });
        thead.appendChild(tr);
        table.appendChild(thead);
        var tbody = el('tbody');
        b.rows.forEach(function (r) {
          var row = el('tr');
          r.forEach(function (c) { row.appendChild(el('td', null, c)); });
          tbody.appendChild(row);
        });
        table.appendChild(tbody);
        wrap.appendChild(table);
        container.appendChild(wrap);
      }
    });
  }

  function addUser(text) {
    var m = el('div', 'msg user');
    m.appendChild(el('div', 'bolha', text));
    log.appendChild(m);
    scrollDown();
  }

  function caminho(res, pergunta) {
    var d = el('details', 'caminho');
    d.appendChild(el('summary', null, 'Como cheguei nessa resposta'));
    var ol = el('ol');
    ol.appendChild(el('li', null, 'Pergunta: "' + pergunta + '"  →  intenção reconhecida: ' + res.intent));
    if (res.sources && res.sources.length) {
      ol.appendChild(el('li', null, 'Fonte equivalente na integração real: ' + res.sources.join(' · ')));
    }
    ol.appendChild(el('li', null, 'Dados usados: js/data.js (fictícios, no formato da Plaid Sandbox)'));
    if (res.calc) ol.appendChild(el('li', null, 'Cálculo: ' + res.calc));
    d.appendChild(ol);
    return d;
  }

  function addBot(res, pergunta) {
    var m = el('div', 'msg bot');
    var b = el('div', 'bolha');
    renderBlocks(b, res.blocks);
    m.appendChild(b);
    if (pergunta) m.appendChild(caminho(res, pergunta));
    log.appendChild(m);
    scrollDown();
  }

  function setChips(list) {
    chips.textContent = '';
    (list || []).slice(0, 4).forEach(function (q) {
      var btn = el('button', null, q);
      btn.type = 'button';
      btn.addEventListener('click', function () { ask(q); });
      chips.appendChild(btn);
    });
  }

  function ask(text) {
    var q = String(text || '').trim();
    if (!q) return;
    addUser(q);
    input.value = '';

    var typing = el('div', 'msg bot digitando');
    typing.appendChild(el('div', 'bolha', 'digitando…'));
    log.appendChild(typing);
    scrollDown();

    var res = window.Engine.answer(q, ctx);
    window.setTimeout(function () {
      if (typing.parentNode) typing.parentNode.removeChild(typing);
      ctx.lastIntent = res.intent;
      addBot(res, q);
      setChips(res.suggestions);
      input.focus();
    }, 250);
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    ask(input.value);
  });

  // mensagem de boas-vindas
  addBot(window.Engine.answer('ajuda', ctx), null);
  setChips(INICIAIS);
})();
