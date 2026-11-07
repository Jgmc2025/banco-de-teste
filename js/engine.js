/*
 * Motor do assistente: transforma uma pergunta em português em uma resposta
 * calculada SOMENTE a partir dos dados de js/data.js (formato Plaid).
 *
 * Princípios (os mesmos do prompt do agente, ver docs/prompt-do-assistente.md):
 *  - nunca inventar número: se o dado não existe, diz que não tem;
 *  - nunca pedir dado sensível;
 *  - valores em US$ (como a Plaid entrega) e, ao lado, em R$ com taxa fixa declarada.
 *
 * Funciona no navegador (window.Engine) e no Node (require), para ser testado.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./data.js'));
  else root.Engine = factory(root.DADOS);
})(typeof self !== 'undefined' ? self : this, function (DADOS) {
  'use strict';

  var RATE = DADOS.usdBrl;
  var TODAY = DADOS.today;
  var ACCOUNTS = DADOS.accounts;
  var TX = DADOS.transactions;

  // Fora do "gasto": renda, transferências entre contas e pagamento de fatura
  // (a compra já foi contada quando passou no cartão; contar o pagamento duplicaria).
  var NON_SPEND = { INCOME: 1, TRANSFER_IN: 1, TRANSFER_OUT: 1, LOAN_PAYMENTS: 1 };

  var CAT_PT = {
    FOOD_AND_DRINK: 'Alimentação',
    TRANSPORTATION: 'Transporte',
    RENT_AND_UTILITIES: 'Moradia e contas',
    ENTERTAINMENT: 'Lazer e assinaturas',
    GENERAL_MERCHANDISE: 'Compras',
    PERSONAL_CARE: 'Bem-estar',
    MEDICAL: 'Saúde',
    TRAVEL: 'Viagens',
    INCOME: 'Renda',
    TRANSFER_IN: 'Transferência recebida',
    TRANSFER_OUT: 'Transferência enviada',
    LOAN_PAYMENTS: 'Pagamento de fatura'
  };

  var MONTH_PT = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  var MONTH_KEY = ['janeiro', 'fevereiro', 'marco', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  var WD_PLURAL = ['aos domingos', 'às segundas-feiras', 'às terças-feiras', 'às quartas-feiras', 'às quintas-feiras', 'às sextas-feiras', 'aos sábados'];

  /* ---------------------------------------------------------------- util */

  function normalize(s) {
    return String(s || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9$%*\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function round2(n) {
    return Math.round((n + Number.EPSILON) * 100) / 100;
  }

  function fmtNum(n, locale) {
    return new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
  }

  function usd(n) {
    return (n < 0 ? '−' : '') + 'US$ ' + fmtNum(round2(Math.abs(n)), 'en-US');
  }

  function brl(n) {
    var v = round2(Math.abs(n) * RATE + 1e-9);
    return (n < 0 ? '−' : '') + 'R$ ' + fmtNum(v, 'pt-BR');
  }

  function brlNative(n) {
    return 'R$ ' + fmtNum(n, 'pt-BR');
  }

  function money(n) {
    return usd(n) + ' (≈ ' + brl(n) + ')';
  }

  function signed(amount) {
    return (amount > 0 ? '−' : '+') + 'US$ ' + fmtNum(round2(Math.abs(amount)), 'en-US');
  }

  function pct(part, whole) {
    if (!whole) return 0;
    return Math.round((part / whole) * 100);
  }

  function fmtDate(iso) {
    return iso.slice(8, 10) + '/' + iso.slice(5, 7) + '/' + iso.slice(0, 4);
  }

  function addDays(iso, d) {
    var t = new Date(iso + 'T12:00:00Z').getTime() + d * 86400000;
    return new Date(t).toISOString().slice(0, 10);
  }

  function weekday(iso) {
    return new Date(iso + 'T12:00:00Z').getUTCDay();
  }

  function sum(list, fn) {
    var t = 0;
    for (var i = 0; i < list.length; i++) t += fn(list[i]);
    return round2(t);
  }

  function accById(id) {
    for (var i = 0; i < ACCOUNTS.length; i++) if (ACCOUNTS[i].account_id === id) return ACCOUNTS[i];
    return null;
  }

  function dataRange() {
    var min = TX[0].date;
    var max = TX[0].date;
    TX.forEach(function (t) {
      if (t.date < min) min = t.date;
      if (t.date > max) max = t.date;
    });
    return { from: min, to: max };
  }

  var RANGE = dataRange();
  var DEFAULT_PERIOD = {
    label: 'todo o período dos dados (' + fmtDate(RANGE.from) + ' a ' + fmtDate(RANGE.to) + ')',
    from: RANGE.from,
    to: RANGE.to,
    isDefault: true
  };

  /* ------------------------------------------------------ blocos de saída */

  function P(text) { return { t: 'p', text: text }; }
  function NOTE(text) { return { t: 'note', text: text }; }
  function LIST(items) { return { t: 'list', items: items }; }
  function TABLE(headers, rows) { return { t: 'table', headers: headers, rows: rows }; }

  /* -------------------------------------------------- período e conta */

  function monthPeriod(y, m) {
    var mm = (m < 10 ? '0' : '') + m;
    var last = new Date(Date.UTC(y, m, 0)).getUTCDate();
    var from = y + '-' + mm + '-01';
    var to = y + '-' + mm + '-' + (last < 10 ? '0' : '') + last;
    var label = MONTH_PT[m - 1] + ' de ' + y;
    if (to >= TODAY && from <= TODAY) {
      to = TODAY;
      label += ' (até ' + fmtDate(TODAY) + ')';
    }
    return { label: label, from: from, to: to };
  }

  function daysPeriod(n, text) {
    var from = addDays(TODAY, -n);
    return { label: text + ' (' + fmtDate(from) + ' a ' + fmtDate(TODAY) + ')', from: from, to: TODAY };
  }

  function parsePeriod(n) {
    var m = n.match(/ultimos? (\d+) dias/);
    if (m) return daysPeriod(parseInt(m[1], 10), 'últimos ' + parseInt(m[1], 10) + ' dias');
    m = n.match(/ultimos? (\d+) mes(es)?/);
    if (m) return daysPeriod(parseInt(m[1], 10) * 30, 'últimos ' + parseInt(m[1], 10) * 30 + ' dias');
    if (/(ultima|esta|essa|nesta|nessa) semana|semana passada/.test(n)) return daysPeriod(7, 'últimos 7 dias');

    var yMatch = n.match(/\b(20\d\d)\b/);
    var year = yMatch ? parseInt(yMatch[1], 10) : parseInt(TODAY.slice(0, 4), 10);
    for (var i = 0; i < MONTH_KEY.length; i++) {
      if (new RegExp('\\b' + MONTH_KEY[i] + '\\b').test(n)) return monthPeriod(year, i + 1);
    }

    var curY = parseInt(TODAY.slice(0, 4), 10);
    var curM = parseInt(TODAY.slice(5, 7), 10);
    if (/mes passado|ultimo mes/.test(n)) {
      var pm = curM === 1 ? 12 : curM - 1;
      var py = curM === 1 ? curY - 1 : curY;
      return monthPeriod(py, pm);
    }
    if (/(este|esse|neste|nesse) mes|mes atual|mes corrente/.test(n)) return monthPeriod(curY, curM);
    return null;
  }

  function parseAccount(n) {
    if (/(cartao|credito|fatura)/.test(n)) return 'acc_credit';
    if (/poupanca/.test(n)) return 'acc_saving';
    if (/(corrente|debito)/.test(n)) return 'acc_checking';
    return null;
  }

  function accLabel(id) {
    if (!id) return '';
    return accById(id).name;
  }

  function filterTx(period, accountId) {
    return TX.filter(function (t) {
      return t.date >= period.from && t.date <= period.to && (!accountId || t.account_id === accountId);
    });
  }

  function spendTx(list) {
    return list.filter(function (t) {
      return t.amount > 0 && !NON_SPEND[t.personal_finance_category.primary];
    });
  }

  function byCategory(list) {
    var map = {};
    list.forEach(function (t) {
      var c = t.personal_finance_category.primary;
      if (!map[c]) map[c] = { cat: c, label: CAT_PT[c] || c, total: 0, count: 0 };
      map[c].total += t.amount;
      map[c].count += 1;
    });
    return Object.keys(map)
      .map(function (k) { map[k].total = round2(map[k].total); return map[k]; })
      .sort(function (a, b) { return b.total - a.total; });
  }

  function scopeText(period, accountId) {
    return (accountId ? 'no ' + accLabel(accountId).toLowerCase() + ', ' : '') + 'em ' + period.label;
  }

  function noData(period, accountId) {
    return {
      blocks: [
        P('Não encontrei lançamentos ' + scopeText(period, accountId) + ' nos dados de demonstração.'),
        NOTE('Os dados fictícios vão de ' + fmtDate(RANGE.from) + ' a ' + fmtDate(RANGE.to) + '. Não vou estimar o que não está lá.')
      ],
      suggestions: ['Quanto gastei em outubro?', 'Gastos por categoria', 'Qual é o meu saldo?']
    };
  }

  /* ---------------------------------------------------------- simulação */

  function fullMonths() {
    var cur = TODAY.slice(0, 7);
    var seen = {};
    TX.forEach(function (t) {
      var k = t.date.slice(0, 7);
      if (k < cur) seen[k] = 1;
    });
    return Object.keys(seen).sort();
  }

  function monthlyStats() {
    var months = fullMonths();
    var spend = 0;
    var income = 0;
    months.forEach(function (mk) {
      var list = TX.filter(function (t) { return t.date.slice(0, 7) === mk; });
      spend += sum(spendTx(list), function (t) { return t.amount; });
      income += sum(list.filter(function (t) { return t.personal_finance_category.primary === 'INCOME'; }), function (t) { return -t.amount; });
    });
    var n = months.length || 1;
    return { months: months, avgSpend: round2(spend / n), avgIncome: round2(income / n) };
  }

  function liquidCash() {
    return round2(
      ACCOUNTS.filter(function (a) { return a.type === 'depository'; })
        .reduce(function (s, a) { return s + a.balances.available; }, 0)
    );
  }

  function cardAvailable() {
    var c = accById('acc_credit');
    return c ? c.balances.available : 0;
  }

  function simulate(pacote) {
    var stats = monthlyStats();
    var priceUsd = round2(pacote.preco_brl / RATE);
    var liquid = liquidCash();
    var reserve = stats.avgSpend; // reserva = 1 mês de gastos médios
    var free = round2(liquid - reserve);
    var surplus = round2(stats.avgIncome - stats.avgSpend);
    var n = pacote.parcelas_max;
    var inst = round2(priceUsd / n);
    var cardAv = cardAvailable();
    var code;
    var monthsNeeded = null;

    if (free > 0 && priceUsd <= free * 0.7) code = 'folga';
    else if (free > 0 && priceUsd <= free) code = 'apertado';
    else if (priceUsd <= cardAv && surplus > 0 && inst <= surplus * 0.5) code = 'parcelar';
    else {
      code = 'nao_cabe';
      if (surplus > 0) monthsNeeded = Math.ceil((priceUsd - Math.max(free, 0)) / surplus);
    }

    return {
      code: code,
      priceUsd: priceUsd,
      liquid: liquid,
      reserve: reserve,
      free: free,
      surplus: surplus,
      installments: n,
      installment: inst,
      cardAvailable: cardAv,
      monthsNeeded: monthsNeeded,
      stats: stats
    };
  }

  function verdictShort(s) {
    if (s.code === 'folga') return 'Cabe à vista com folga';
    if (s.code === 'apertado') return 'Cabe à vista, mas apertado';
    if (s.code === 'parcelar') return 'Melhor parcelar (' + s.installments + 'x de ' + usd(s.installment) + ')';
    return 'Ainda não cabe';
  }

  function findPacote(n) {
    for (var i = 0; i < DADOS.pacotes.length; i++) {
      var p = DADOS.pacotes[i];
      for (var j = 0; j < p.aliases.length; j++) {
        if (new RegExp('\\b' + p.aliases[j] + '\\b').test(n)) return p;
      }
    }
    return null;
  }

  /* ------------------------------------------------------------- intents */

  function detectIntent(n) {
    if (/(senha|cvv|\btoken\b|codigo de (seguranca|verificacao)|codigo (do )?sms|numero (completo )?do cartao|\bcpf\b|\bpin\b)/.test(n)) return 'sensivel';
    if (/\bmcp\b/.test(n)) return 'mcp';
    if (/open ?finance/.test(n)) return 'openfinance';
    if (/(\bitem\b|\bitens\b|pluggy|plaid)/.test(n) && /(o que|que e|significa|explique|explica|conceito|como funciona|serve)/.test(n)) return 'fontes';
    if (/(divida|negativ|devendo)/.test(n) && /(cartao|credito|saldo)/.test(n) && /(por ?que|porque|pq|como|aparece)/.test(n)) return 'cartao_divida';

    var pk = findPacote(n);
    var tripWord = /(viagem|viajar|pacote|ferias)/.test(n);
    var tripAsk = /(posso|consigo|cabe|pagar|comprar|parcel|pacote|vale a pena|da pra|planej|simul|quero)/.test(n);
    var spendWord = /(gastei|gastos?|despesas?|paguei)/.test(n);
    if (pk && !spendWord) return 'viagem';
    if (tripWord && !spendWord && (!/poupanca/.test(n) || tripAsk)) return 'viagem';

    if (/(padrao|padroes|habito|habitos|perfil de gasto|onde (eu )?mais gasto|como eu gasto)/.test(n)) return 'padroes';
    if (/maior(es)? (gasto|compra|despesa)/.test(n) || /(gasto|compra|despesa)s? mais (alto|alta|caro|cara)/.test(n)) return 'maior';
    if (/(transac|extrato|movimentac|ultimas? compras|ultimos? gastos|compras recentes|lancamento|historico)/.test(n)) return 'extrato';
    if (/(categoria|gast|despes|paguei|quanto saiu|saidas)/.test(n)) return 'gastos';
    if (/(cartao|fatura|limite|credito)/.test(n)) return 'cartao';
    if (/(saldo|quanto (eu )?tenho|dinheiro|disponivel|tenho na conta)/.test(n)) return 'saldo';
    if (/(poupanca|corrente)/.test(n)) return 'saldo';
    if (/\bcontas?\b/.test(n)) return 'contas';
    if (/(salario|renda|recebi|receita|entrou)/.test(n)) return 'renda';
    if (/(^| )(oi|ola|bom dia|boa tarde|boa noite|ajuda|help|menu)( |$)|o que voce (faz|pode)|como (voce )?funciona|quem e voce/.test(n)) return 'ajuda';
    return null;
  }

  var FOLLOWABLE = { gastos: 1, extrato: 1, maior: 1, saldo: 1, cartao: 1, renda: 1 };

  var SOURCES = {
    saldo: ['Plaid · /accounts/balance/get'],
    contas: ['Plaid · /accounts/get'],
    extrato: ['Plaid · /transactions/get (ou /transactions/sync)'],
    gastos: ['Plaid · /transactions/get (ou /transactions/sync)'],
    maior: ['Plaid · /transactions/get (ou /transactions/sync)'],
    renda: ['Plaid · /transactions/get (ou /transactions/sync)'],
    padroes: ['Plaid · /transactions/get (ou /transactions/sync)'],
    cartao: ['Plaid · /accounts/balance/get', 'Plaid · /transactions/get'],
    cartao_divida: ['Plaid · /accounts/balance/get (campos balances.current, limit e available)'],
    viagem: ['Plaid · /accounts/balance/get', 'Plaid · /transactions/get', 'Catálogo fictício de pacotes (js/data.js)'],
    fontes: ['Conceitos da documentação da Pluggy e da Plaid (resumo)'],
    mcp: ['Conceito: Model Context Protocol'],
    openfinance: ['Aviso do projeto'],
    sensivel: [],
    ajuda: [],
    fallback: []
  };

  var H = {};

  /* ---- saldo / contas / cartão */

  H.saldo = function (n) {
    var accId = parseAccount(n);
    if (accId === 'acc_credit') return H.cartao(n);

    var list = accId ? [accById(accId)] : ACCOUNTS;
    var rows = [];
    list.forEach(function (a) {
      if (a.type === 'credit') {
        rows.push([a.name, 'Dívida atual (o que você deve)', money(a.balances.current)]);
        rows.push([a.name, 'Limite disponível (de ' + usd(a.balances.limit) + ')', money(a.balances.available)]);
      } else {
        rows.push([a.name, 'Saldo disponível', money(a.balances.available)]);
      }
    });
    var blocks = [TABLE(['Conta', 'O que é', 'Valor'], rows)];
    if (!accId) {
      blocks.unshift(P('Seu dinheiro hoje: ' + money(liquidCash()) + ' somando conta corrente e poupança.'));
      blocks.push(NOTE('No cartão de crédito o valor é dívida, não dinheiro seu. Por isso ele não entra na soma.'));
    }
    return {
      blocks: blocks,
      calc: 'Somei balances.available das contas do tipo depository. Crédito fica fora da soma.',
      suggestions: ['Por que o saldo do cartão aparece como dívida?', 'Quanto gastei em outubro?', 'Posso pagar o pacote de Noronha?']
    };
  };

  H.contas = function () {
    var rows = ACCOUNTS.map(function (a) {
      return [a.name, a.subtype, '•••• ' + a.mask, a.official_name];
    });
    return {
      blocks: [P('Você tem ' + ACCOUNTS.length + ' contas conectadas (todas fictícias):'), TABLE(['Conta', 'Tipo', 'Final', 'Nome oficial'], rows)],
      calc: 'Listei o array accounts na ordem em que ele chega.',
      suggestions: ['Qual é o meu saldo?', 'Me explique o cartão', 'Gastos por conta']
    };
  };

  H.cartao = function (n) {
    var c = accById('acc_credit');
    var b = c.balances;
    var last = TX.filter(function (t) { return t.account_id === 'acc_credit' && t.amount > 0; })
      .sort(function (a, z) { return a.date < z.date ? 1 : a.date > z.date ? -1 : 0; })
      .slice(0, 3);
    return {
      blocks: [
        P('No ' + c.name.toLowerCase() + ' você deve ' + money(b.current) + ' e ainda pode usar ' + money(b.available) + ' do limite de ' + usd(b.limit) + '.'),
        P('Isso é ' + pct(b.current, b.limit) + '% do limite em uso.'),
        TABLE(['Data', 'Descrição', 'Valor'], last.map(function (t) { return [fmtDate(t.date), t.name, signed(t.amount)]; })),
        NOTE('Últimas 3 compras no cartão. O valor da dívida vem do saldo da conta, não da soma dessas compras.')
      ],
      calc: 'dívida = balances.current; disponível = balances.available (= limite − dívida); uso = dívida ÷ limite.',
      suggestions: ['Por que o saldo do cartão aparece como dívida?', 'Quanto gastei no cartão em outubro?', 'Posso pagar o pacote de Gramado?']
    };
  };

  H.cartao_divida = function () {
    var b = accById('acc_credit').balances;
    return {
      blocks: [
        P('Porque, em contas de crédito, a Plaid usa o campo balances.current para o quanto você DEVE, não para o que você tem.'),
        LIST([
          'Dívida atual (current): ' + money(b.current),
          'Limite (limit): ' + usd(b.limit),
          'Disponível (available): ' + usd(b.available) + ', que é o limite menos a dívida'
        ]),
        NOTE('Compra no cartão é valor positivo (saída) e pagamento da fatura é valor negativo (entrada), a mesma regra das contas comuns.')
      ],
      calc: 'Mostrei os três campos de balances do cartão e a relação available = limit − current.',
      suggestions: ['Me explique o cartão', 'Qual é o meu saldo?']
    };
  };

  /* ---- gastos, extrato, maior, renda */

  H.gastos = function (n) {
    var period = parsePeriod(n) || DEFAULT_PERIOD;
    var accId = parseAccount(n);
    var spend = spendTx(filterTx(period, accId));
    if (!spend.length) return noData(period, accId);

    var total = sum(spend, function (t) { return t.amount; });
    var cats = byCategory(spend);
    var blocks = [];
    var wantAcc = /(por conta|cada conta|por cartao|cada cartao)/.test(n);
    var wantCat = /categoria/.test(n);

    if (/viage/.test(n) && !spend.some(function (t) { return t.personal_finance_category.primary === 'TRAVEL'; })) {
      blocks.push(P('Não há lançamentos na categoria Viagens nos dados de demonstração. Segue o total geral do recorte:'));
    }
    blocks.push(P('Você gastou ' + money(total) + ' ' + scopeText(period, accId) + ', em ' + spend.length + ' lançamentos.'));

    if (wantAcc && !accId) {
      var accRows = ACCOUNTS.map(function (a) {
        var l = spend.filter(function (t) { return t.account_id === a.account_id; });
        var tt = sum(l, function (t) { return t.amount; });
        return { name: a.name, total: tt, count: l.length };
      }).filter(function (r) { return r.count > 0; })
        .sort(function (a, z) { return z.total - a.total; });
      blocks.push(TABLE(['Conta', 'Total (US$)', 'Em reais (≈)', '% do total'],
        accRows.map(function (r) { return [r.name, usd(r.total), brl(r.total), pct(r.total, total) + '%']; })));
    } else {
      var shown = wantCat ? cats : cats.slice(0, 5);
      blocks.push(TABLE(['Categoria', 'Total (US$)', 'Em reais (≈)', '% do total'],
        shown.map(function (r) { return [r.label, usd(r.total), brl(r.total), pct(r.total, total) + '%']; })));
      if (!wantCat && cats.length > 5) blocks.push(NOTE('Mostrando as 5 maiores categorias de ' + cats.length + '. Peça "gastos por categoria" para ver todas.'));
    }
    blocks.push(NOTE('Não conto como gasto: salário, transferências entre contas e pagamento de fatura (a compra já foi contada quando passou no cartão).'));
    return {
      blocks: blocks,
      calc: 'Filtrei por data' + (accId ? ' e conta' : '') + ', mantive só valores positivos fora de renda, transferências e pagamento de fatura, e somei por categoria (personal_finance_category.primary).',
      suggestions: ['Gastos por categoria', 'Gastos por conta', 'Quais são meus padrões de gasto?']
    };
  };

  H.extrato = function (n) {
    var period = parsePeriod(n) || DEFAULT_PERIOD;
    var accId = parseAccount(n);
    var list = filterTx(period, accId).sort(function (a, z) {
      if (a.date !== z.date) return a.date < z.date ? 1 : -1;
      return a.transaction_id < z.transaction_id ? 1 : -1;
    });
    if (!list.length) return noData(period, accId);
    var shown = list.slice(0, 8);
    return {
      blocks: [
        P('Mostrando as ' + shown.length + ' mais recentes de ' + list.length + ' lançamentos ' + scopeText(period, accId) + ':'),
        TABLE(['Data', 'Descrição', 'Conta', 'Valor'], shown.map(function (t) {
          return [fmtDate(t.date), t.name, accById(t.account_id).name, signed(t.amount)];
        })),
        NOTE('Na Plaid, valor positivo é saída. Aqui mostro do seu ponto de vista: − saiu, + entrou. Valores em US$.')
      ],
      calc: 'Ordenei por data (mais recente primeiro) e inverti o sinal só na exibição.',
      suggestions: ['Quanto gastei em outubro?', 'Qual foi o meu maior gasto?', 'Quais são meus padrões de gasto?']
    };
  };

  H.maior = function (n) {
    var period = parsePeriod(n) || DEFAULT_PERIOD;
    var accId = parseAccount(n);
    var spend = spendTx(filterTx(period, accId)).sort(function (a, z) { return z.amount - a.amount; });
    if (!spend.length) return noData(period, accId);
    var top = spend.slice(0, 3);
    return {
      blocks: [
        P('O maior gasto ' + scopeText(period, accId) + ' foi "' + top[0].name + '": ' + money(top[0].amount) + '.'),
        TABLE(['Data', 'Descrição', 'Conta', 'Valor'], top.map(function (t) {
          return [fmtDate(t.date), t.name, accById(t.account_id).name, usd(t.amount)];
        })),
        NOTE('Os três maiores lançamentos de gasto no recorte.')
      ],
      calc: 'Mesmo filtro de gasto, ordenado do maior valor para o menor.',
      suggestions: ['Gastos por categoria', 'Quais são meus padrões de gasto?']
    };
  };

  H.renda = function (n) {
    var period = parsePeriod(n) || DEFAULT_PERIOD;
    var inc = filterTx(period, null).filter(function (t) { return t.personal_finance_category.primary === 'INCOME'; });
    if (!inc.length) return noData(period, null);
    var total = sum(inc, function (t) { return -t.amount; });
    return {
      blocks: [
        P('Você recebeu ' + money(total) + ' em renda ' + 'em ' + period.label + '.'),
        TABLE(['Data', 'Origem', 'Valor'], inc.sort(function (a, z) { return a.date < z.date ? -1 : 1; }).map(function (t) {
          return [fmtDate(t.date), t.name, usd(-t.amount)];
        })),
        NOTE('Transferência entre as suas próprias contas não conta como renda.')
      ],
      calc: 'Somei os lançamentos de categoria INCOME (na Plaid, entrada é valor negativo, então inverti o sinal).',
      suggestions: ['Quanto gastei em outubro?', 'Posso pagar o pacote de Noronha?']
    };
  };

  /* ---- padrões de gasto */

  H.padroes = function (n) {
    var period = parsePeriod(n) || DEFAULT_PERIOD;
    var spend = spendTx(filterTx(period, parseAccount(n)));
    if (spend.length < 3) return noData(period, null);
    var total = sum(spend, function (t) { return t.amount; });
    var cats = byCategory(spend);
    var items = [];

    // 1) categoria dominante
    items.push('Peso por categoria: "' + cats[0].label + '" lidera com ' + usd(cats[0].total) + ' (' + pct(cats[0].total, total) + '% dos gastos), seguida de "' + (cats[1] ? cats[1].label : '—') + '" (' + (cats[1] ? pct(cats[1].total, total) : 0) + '%).');

    // 2) recorrentes: mesmo estabelecimento em 2+ meses com valor parecido
    var groups = {};
    spend.forEach(function (t) {
      var k = t.merchant_name || t.name;
      if (!groups[k]) groups[k] = { name: k, months: {}, amounts: [], total: 0 };
      groups[k].months[t.date.slice(0, 7)] = 1;
      groups[k].amounts.push(t.amount);
      groups[k].total += t.amount;
    });
    var recurring = Object.keys(groups).map(function (k) { return groups[k]; }).filter(function (g) {
      var mn = Math.min.apply(null, g.amounts);
      var mx = Math.max.apply(null, g.amounts);
      return Object.keys(g.months).length >= 2 && mx / mn <= 1.15;
    }).map(function (g) {
      var m = Object.keys(g.months).length;
      return { name: g.name, months: m, avg: round2(g.total / m) };
    }).sort(function (a, z) { return z.avg - a.avg; });
    var fixedTotal = sum(recurring, function (r) { return r.avg; });
    items.push('Gastos que se repetem todo mês: ' + recurring.length + ' estabelecimentos, somando cerca de ' + money(fixedTotal) + ' por mês (tabela abaixo).');

    // 3) dia da semana
    var wd = [];
    Object.keys(groups).forEach(function (k) {
      var list = spend.filter(function (t) { return (t.merchant_name || t.name) === k; });
      if (list.length < 4) return;
      var counts = {};
      list.forEach(function (t) { var d = weekday(t.date); counts[d] = (counts[d] || 0) + 1; });
      var topDay = Object.keys(counts).sort(function (a, z) { return counts[z] - counts[a]; })[0];
      if (counts[topDay] / list.length >= 0.75) {
        wd.push('"' + k + '": ' + counts[topDay] + ' de ' + list.length + ' compras caíram ' + WD_PLURAL[topDay] + ', com média de ' + usd(sum(list, function (t) { return t.amount; }) / list.length) + '.');
      }
    });
    var weekend = sum(spend.filter(function (t) { var d = weekday(t.date); return d === 0 || d === 6; }), function (t) { return t.amount; });
    items.push('Dia da semana: ' + (wd.length ? wd.join(' ') + ' ' : '') + 'No total, ' + pct(weekend, total) + '% do gasto cai no fim de semana.');

    return {
      blocks: [
        P('Três padrões nos seus gastos de ' + period.label + ':'),
        LIST(items),
        TABLE(['Gasto recorrente', 'Meses', 'Média por mês'], recurring.map(function (r) { return [r.name, String(r.months), usd(r.avg)]; })),
        NOTE('Recorrente = mesmo estabelecimento em 2 ou mais meses, com valores até 15% diferentes entre si.')
      ],
      calc: 'Agrupei por estabelecimento (merchant_name), medi a variação dos valores e contei os dias da semana de cada compra.',
      suggestions: ['Gastos por categoria', 'Posso pagar o pacote de Noronha?', 'Qual foi o meu maior gasto?']
    };
  };

  /* ---- viagem */

  H.viagem = function (n) {
    var pk = findPacote(n);
    var blocks = [];

    if (!pk) {
      var rows = DADOS.pacotes.map(function (p) {
        var s = simulate(p);
        return [p.nome, brlNative(p.preco_brl) + ' (≈ ' + usd(s.priceUsd) + ')', verdictShort(s)];
      });
      var st = monthlyStats();
      blocks.push(P('Comparei os três pacotes. Seu dinheiro hoje é ' + money(liquidCash()) + ' e a reserva sugerida (1 mês de gastos médios) é ' + money(st.avgSpend) + ':'));
      blocks.push(TABLE(['Pacote', 'Preço', 'Veredito'], rows));
      blocks.push(NOTE('Pergunte por um pacote específico (ex.: "Posso pagar Noronha?") para ver a conta completa. Simulação educativa com dados fictícios.'));
      return {
        blocks: blocks,
        calc: 'Para cada pacote: preço em US$ = preço em R$ ÷ ' + RATE + '; disponível = saldo líquido − reserva; veredito pela regra do README.',
        suggestions: ['Posso pagar Noronha?', 'Posso pagar Gramado?', 'Posso pagar Lisboa?']
      };
    }

    var s = simulate(pk);
    blocks.push(P(pk.nome + ' custa ' + brlNative(pk.preco_brl) + ' (≈ ' + usd(s.priceUsd) + ').'));
    blocks.push(TABLE(['Sua situação', 'Valor'], [
      ['Dinheiro líquido (corrente + poupança)', money(s.liquid)],
      ['Reserva de segurança (1 mês de gastos médios)', money(s.reserve)],
      ['Disponível para a viagem', money(Math.max(s.free, 0))],
      ['Sobra mensal média (renda − gastos)', money(s.surplus)],
      ['Limite disponível no cartão', money(s.cardAvailable)]
    ]));

    var text;
    if (s.code === 'folga') {
      text = 'Cabe à vista com folga: o pacote usa ' + pct(s.priceUsd, s.free) + '% do que está disponível e ainda sobrariam ' + money(s.free - s.priceUsd) + ' além da reserva.';
    } else if (s.code === 'apertado') {
      text = 'Cabe à vista, mas apertado: sobrariam só ' + money(s.free - s.priceUsd) + ' além da reserva. Parcelar em ' + s.installments + 'x de ' + money(s.installment) + ' deixa o caixa mais folgado.';
    } else if (s.code === 'parcelar') {
      text = 'À vista você teria que usar a reserva. Parcelado em ' + s.installments + 'x de ' + money(s.installment) + ', a parcela usa ' + pct(s.installment, s.surplus) + '% da sua sobra mensal média e cabe no limite do cartão.';
    } else {
      text = 'Ainda não cabe com segurança. ' + (s.monthsNeeded
        ? 'Guardando a sobra mensal média, faltam cerca de ' + s.monthsNeeded + ' meses.'
        : 'Os dados não mostram sobra mensal para juntar o valor.');
    }
    blocks.push(P(text));
    blocks.push(NOTE('Simulação educativa com dados fictícios. Considera parcelas sem juros (condição de demonstração) e não é recomendação financeira.'));

    return {
      blocks: blocks,
      calc: 'Preço em US$ = ' + brlNative(pk.preco_brl) + ' ÷ ' + RATE + '. Disponível = saldo líquido − reserva. Sobra mensal = média de renda − média de gastos dos meses fechados (' + s.stats.months.join(', ') + ').',
      suggestions: ['Compare os pacotes', 'Quais são meus padrões de gasto?', 'Qual é o meu saldo?']
    };
  };

  /* ---- conceitos */

  H.fontes = function () {
    return {
      blocks: [
        P('Resumo das peças deste projeto:'),
        LIST([
          'Item: é a conexão de uma pessoa com uma instituição financeira. É por ele que chegam contas, saldos e transações, e ele carrega o estado dessa conexão.',
          'Pluggy: plataforma brasileira de integração bancária. Aqui entra só pela documentação, via servidor MCP.',
          'Plaid: fornece o banco de teste (Sandbox) com dados fictícios, que é de onde vem o formato dos dados deste app.'
        ]),
        NOTE('Resumo conceitual. Confirme os detalhes nas documentações oficiais da Pluggy e da Plaid.')
      ],
      calc: 'Resposta conceitual, sem cálculo e sem dados da conta.',
      suggestions: ['O que é MCP?', 'Isso é Open Finance?', 'Qual é o meu saldo?']
    };
  };

  H.mcp = function () {
    return {
      blocks: [
        P('MCP (Model Context Protocol) é um padrão aberto para a IA se conectar a ferramentas e fontes externas, como uma tomada padrão.'),
        LIST([
          'Pluggy: servidor remoto (Streamable HTTP) que serve a documentação.',
          'Plaid: servidor local (STDIO) que acessa o banco de teste.'
        ]),
        NOTE('Este site usa dados locais fictícios. As chaves da Plaid nunca ficam no navegador; para integração real, elas ficam num backend.')
      ],
      calc: 'Resposta conceitual.',
      suggestions: ['O que é um Item?', 'Isso é Open Finance?']
    };
  };

  H.openfinance = function () {
    return {
      blocks: [
        P('Não. A Plaid Sandbox é só um laboratório com dados inventados e não representa o Open Finance brasileiro.'),
        P('Em produção, o Open Finance exige consentimento do cliente e segurança reforçada. Este app não acessa nenhuma conta real.')
      ],
      calc: 'Aviso do projeto.',
      suggestions: ['O que é MCP?', 'Qual é o meu saldo?']
    };
  };

  H.sensivel = function () {
    return {
      blocks: [
        P('Não envie senha, token, código de SMS, CPF nem número de cartão por aqui. Este assistente nunca pede esses dados e só enxerga dados fictícios.'),
        P('Se tem uma dúvida sobre saldo, gastos ou viagem, pode perguntar normalmente.')
      ],
      calc: 'A pergunta citou um dado sensível; respondi sem usar o conteúdo dela.',
      suggestions: ['Qual é o meu saldo?', 'Quanto gastei em outubro?']
    };
  };

  H.ajuda = function () {
    return {
      blocks: [
        P('Sou o assistente financeiro da Rota Viva Viagens (agência fictícia). Respondo em português usando os dados de teste do banco:'),
        LIST([
          'Saldos e contas, incluindo o cartão',
          'Gastos por categoria, período ou conta',
          'Extrato e maior gasto',
          'Padrões de gasto',
          'Se um pacote de viagem cabe no seu bolso'
        ]),
        NOTE('Tudo aqui é fictício. Valores em US$, com conversão para R$ a ' + RATE.toFixed(2).replace('.', ',') + ' (taxa fixa de demonstração).')
      ],
      calc: 'Mensagem de apresentação.',
      suggestions: ['Qual é o meu saldo?', 'Quanto gastei em outubro?', 'Posso pagar o pacote de Noronha?']
    };
  };

  function fallback() {
    return {
      intent: 'fallback',
      blocks: [
        P('Não encontrei isso nos dados de demonstração e prefiro não chutar.'),
        P('Posso responder sobre saldos, contas, cartão, gastos (por categoria, período ou conta), extrato, padrões de gasto e simulação de pacotes de viagem.')
      ],
      calc: 'Nenhuma intenção reconhecida; não inventei resposta.',
      sources: [],
      suggestions: ['Qual é o meu saldo?', 'Quanto gastei em outubro?', 'Posso pagar o pacote de Noronha?']
    };
  }

  /* ----------------------------------------------------------------- API */

  function answer(question, ctx) {
    var n = normalize(question);
    if (!n) return fallback();

    var intent = detectIntent(n);
    if (!intent && ctx && ctx.lastIntent && FOLLOWABLE[ctx.lastIntent] && (parsePeriod(n) || parseAccount(n))) {
      intent = ctx.lastIntent;
    }
    if (!intent || !H[intent]) return fallback();

    var r = H[intent](n);
    r.intent = intent;
    r.sources = SOURCES[intent] || [];
    return r;
  }

  return {
    answer: answer,
    detectIntent: detectIntent,
    normalize: normalize,
    parsePeriod: parsePeriod,
    parseAccount: parseAccount,
    simulate: simulate,
    spendTx: spendTx,
    filterTx: filterTx,
    byCategory: byCategory,
    usd: usd,
    brl: brl,
    money: money,
    RATE: RATE,
    TODAY: TODAY
  };
});
