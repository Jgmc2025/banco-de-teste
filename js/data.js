/*
 * DADOS FICTÍCIOS DE DEMONSTRAÇÃO.
 *
 * Esta pasta de dados imita o FORMATO do Plaid Sandbox (accounts, balances,
 * transactions, personal_finance_category), mas os valores foram inventados
 * para este projeto. Nada aqui vem de uma conta bancária real.
 *
 * Convenções da Plaid que o assistente respeita:
 *  - transactions[].amount POSITIVO = saída de dinheiro (gasto); NEGATIVO = entrada.
 *  - Em contas de crédito, balances.current é o quanto o cliente DEVE (dívida).
 *    O que ele ainda pode usar é balances.available = limit - current.
 *
 * Quando a integração real (MCP da Plaid) estiver ligada num backend, este
 * arquivo é o único que precisa ser trocado: o motor (engine.js) só lê este formato.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.DADOS = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var accounts = [
    {
      account_id: 'acc_checking',
      name: 'Conta Corrente',
      official_name: 'Conta Corrente Rota Viva (fictícia)',
      type: 'depository',
      subtype: 'checking',
      mask: '0001',
      balances: { available: 1420.55, current: 1420.55, limit: null, iso_currency_code: 'USD' }
    },
    {
      account_id: 'acc_saving',
      name: 'Poupança Viagem',
      official_name: 'Poupança Viagem (fictícia)',
      type: 'depository',
      subtype: 'savings',
      mask: '0002',
      balances: { available: 2150.0, current: 2150.0, limit: null, iso_currency_code: 'USD' }
    },
    {
      account_id: 'acc_credit',
      name: 'Cartão de Crédito',
      official_name: 'Cartão de Crédito Rota Viva (fictício)',
      type: 'credit',
      subtype: 'credit card',
      mask: '0003',
      // current = dívida atual; available = limite - dívida
      balances: { available: 3754.7, current: 1245.3, limit: 5000.0, iso_currency_code: 'USD' }
    }
  ];

  // [data, conta, descrição, estabelecimento, valor (positivo = saída), categoria primária]
  var C = 'acc_checking';
  var S = 'acc_saving';
  var K = 'acc_credit';
  var rows = [
    // Renda
    ['2026-09-01', C, 'Salário Empresa Alfa', 'Empresa Alfa', -3200.0, 'INCOME'],
    ['2026-10-01', C, 'Salário Empresa Alfa', 'Empresa Alfa', -3200.0, 'INCOME'],
    ['2026-11-02', C, 'Salário Empresa Alfa', 'Empresa Alfa', -3200.0, 'INCOME'],

    // Transferências para a poupança (saída na corrente, entrada na poupança)
    ['2026-09-02', C, 'Transferência para Poupança Viagem', null, 300.0, 'TRANSFER_OUT'],
    ['2026-09-02', S, 'Transferência da Conta Corrente', null, -300.0, 'TRANSFER_IN'],
    ['2026-10-02', C, 'Transferência para Poupança Viagem', null, 300.0, 'TRANSFER_OUT'],
    ['2026-10-02', S, 'Transferência da Conta Corrente', null, -300.0, 'TRANSFER_IN'],
    ['2026-11-03', C, 'Transferência para Poupança Viagem', null, 300.0, 'TRANSFER_OUT'],
    ['2026-11-03', S, 'Transferência da Conta Corrente', null, -300.0, 'TRANSFER_IN'],

    // Pagamento da fatura do cartão (saída na corrente, entrada no cartão)
    ['2026-09-08', C, 'Pagamento de fatura do cartão', null, 850.0, 'LOAN_PAYMENTS'],
    ['2026-09-08', K, 'Pagamento recebido', null, -850.0, 'LOAN_PAYMENTS'],
    ['2026-10-08', C, 'Pagamento de fatura do cartão', null, 980.0, 'LOAN_PAYMENTS'],
    ['2026-10-08', K, 'Pagamento recebido', null, -980.0, 'LOAN_PAYMENTS'],

    // Moradia e contas fixas
    ['2026-09-05', C, 'Aluguel - Imobiliária Sol', 'Imobiliária Sol', 1200.0, 'RENT_AND_UTILITIES'],
    ['2026-10-05', C, 'Aluguel - Imobiliária Sol', 'Imobiliária Sol', 1200.0, 'RENT_AND_UTILITIES'],
    ['2026-11-05', C, 'Aluguel - Imobiliária Sol', 'Imobiliária Sol', 1200.0, 'RENT_AND_UTILITIES'],
    ['2026-09-10', C, 'Energia Elétrica', 'Companhia de Energia', 148.2, 'RENT_AND_UTILITIES'],
    ['2026-10-10', C, 'Energia Elétrica', 'Companhia de Energia', 132.75, 'RENT_AND_UTILITIES'],
    ['2026-09-14', C, 'Internet Fibra Net', 'Internet Fibra Net', 79.9, 'RENT_AND_UTILITIES'],
    ['2026-10-14', C, 'Internet Fibra Net', 'Internet Fibra Net', 79.9, 'RENT_AND_UTILITIES'],

    // Bem-estar e saúde
    ['2026-09-03', C, 'Academia Forma', 'Academia Forma', 49.9, 'PERSONAL_CARE'],
    ['2026-10-03', C, 'Academia Forma', 'Academia Forma', 49.9, 'PERSONAL_CARE'],
    ['2026-11-03', C, 'Academia Forma', 'Academia Forma', 49.9, 'PERSONAL_CARE'],
    ['2026-09-30', C, 'Farmácia Saúde', 'Farmácia Saúde', 22.8, 'MEDICAL'],
    ['2026-10-22', C, 'Farmácia Saúde', 'Farmácia Saúde', 36.4, 'MEDICAL'],

    // Mercado (débito na corrente)
    ['2026-09-06', C, 'Mercado Bom Preço', 'Mercado Bom Preço', 182.4, 'FOOD_AND_DRINK'],
    ['2026-09-20', C, 'Mercado Bom Preço', 'Mercado Bom Preço', 156.1, 'FOOD_AND_DRINK'],
    ['2026-10-04', C, 'Mercado Bom Preço', 'Mercado Bom Preço', 171.85, 'FOOD_AND_DRINK'],
    ['2026-10-18', C, 'Mercado Bom Preço', 'Mercado Bom Preço', 149.6, 'FOOD_AND_DRINK'],
    ['2026-11-01', C, 'Mercado Bom Preço', 'Mercado Bom Preço', 188.3, 'FOOD_AND_DRINK'],

    // Delivery todo sábado (cartão)
    ['2026-09-12', K, 'Delivery FoodGo', 'Delivery FoodGo', 42.5, 'FOOD_AND_DRINK'],
    ['2026-09-19', K, 'Delivery FoodGo', 'Delivery FoodGo', 38.9, 'FOOD_AND_DRINK'],
    ['2026-09-26', K, 'Delivery FoodGo', 'Delivery FoodGo', 45.2, 'FOOD_AND_DRINK'],
    ['2026-10-03', K, 'Delivery FoodGo', 'Delivery FoodGo', 41.7, 'FOOD_AND_DRINK'],
    ['2026-10-10', K, 'Delivery FoodGo', 'Delivery FoodGo', 47.6, 'FOOD_AND_DRINK'],
    ['2026-10-17', K, 'Delivery FoodGo', 'Delivery FoodGo', 39.8, 'FOOD_AND_DRINK'],
    ['2026-10-24', K, 'Delivery FoodGo', 'Delivery FoodGo', 44.3, 'FOOD_AND_DRINK'],
    ['2026-10-31', K, 'Delivery FoodGo', 'Delivery FoodGo', 46.1, 'FOOD_AND_DRINK'],
    ['2026-11-06', K, 'Restaurante Maré', 'Restaurante Maré', 58.0, 'FOOD_AND_DRINK'],

    // Transporte (cartão)
    ['2026-09-09', K, 'Corrida App Move', 'App Move', 18.4, 'TRANSPORTATION'],
    ['2026-09-23', K, 'Corrida App Move', 'App Move', 22.1, 'TRANSPORTATION'],
    ['2026-10-07', K, 'Corrida App Move', 'App Move', 19.75, 'TRANSPORTATION'],
    ['2026-10-21', K, 'Corrida App Move', 'App Move', 24.6, 'TRANSPORTATION'],
    ['2026-11-04', K, 'Corrida App Move', 'App Move', 21.3, 'TRANSPORTATION'],

    // Assinaturas e lazer (cartão)
    ['2026-09-12', K, 'Streaming Max', 'Streaming Max', 15.99, 'ENTERTAINMENT'],
    ['2026-10-12', K, 'Streaming Max', 'Streaming Max', 15.99, 'ENTERTAINMENT'],
    ['2026-09-15', K, 'Música Plus', 'Música Plus', 9.99, 'ENTERTAINMENT'],
    ['2026-10-15', K, 'Música Plus', 'Música Plus', 9.99, 'ENTERTAINMENT'],
    ['2026-09-27', K, 'Cine Centro', 'Cine Centro', 24.0, 'ENTERTAINMENT'],
    ['2026-10-09', K, 'Cine Centro', 'Cine Centro', 28.0, 'ENTERTAINMENT'],

    // Compras
    ['2026-09-28', K, 'Loja Mala & Cia', 'Loja Mala & Cia', 89.9, 'GENERAL_MERCHANDISE']
  ];

  var transactions = rows.map(function (r, i) {
    var n = String(i + 1);
    while (n.length < 3) n = '0' + n;
    return {
      transaction_id: 'tx_' + n,
      account_id: r[1],
      date: r[0],
      name: r[2],
      merchant_name: r[3],
      amount: r[4],
      iso_currency_code: 'USD',
      pending: false,
      personal_finance_category: { primary: r[5] }
    };
  });

  // Pacotes de viagem FICTÍCIOS da agência fictícia "Rota Viva Viagens".
  var pacotes = [
    { id: 'noronha', nome: 'Fernando de Noronha · 5 dias', preco_brl: 6900, parcelas_max: 10, aliases: ['noronha'] },
    { id: 'gramado', nome: 'Gramado · 4 dias', preco_brl: 3200, parcelas_max: 10, aliases: ['gramado'] },
    { id: 'lisboa', nome: 'Lisboa · 7 dias', preco_brl: 12500, parcelas_max: 10, aliases: ['lisboa', 'portugal'] }
  ];

  return {
    ficticio: true,
    // "Hoje" fixo para a demonstração ser reprodutível (07/11/2026).
    today: '2026-11-07',
    // Taxa FIXA de demonstração, declarada na interface. Não é cotação real.
    usdBrl: 5.5,
    accounts: accounts,
    transactions: transactions,
    pacotes: pacotes
  };
});
