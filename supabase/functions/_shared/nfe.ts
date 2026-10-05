// Monta a NF-e (modelo 55) da Brasil NFe a partir de um pedido do Disk.
// TypeScript puro, sem import: a edge function usa e os testes do vitest também.

export type NfeItem = {
  productId: string;
  name: string;
  qty: number;
  unitPrice: number | null;
  ncm: string | null;
  cest: string | null;
  cfop: string | null;
  cstCsosn: string | null;
  /** CST de PIS e de COFINS (o mesmo para os dois). Alíquota vai zerada:
   *  regime com alíquota de PIS/COFINS deve usar o grupo tributário. */
  pisCofinsCst?: string | null;
  origem: number;
  unidade: string;
  taxGroup: string | null;
};

export type NfeInput = {
  orderId: string;
  channel: string;
  fulfillmentType: string;
  totalAmount: number | null;
  payment: {
    method: string | null;
    method2: string | null;
    amount1: number | null;
    amount2: number | null;
    isSplit: boolean;
    dueDate: string | null;
    paidAt: string | null;
  };
  customer: {
    name: string;
    /** Razão social; quando vazia, a nota usa o nome do cadastro. */
    legalName?: string | null;
    type: "PF" | "PJ";
    cpf: string | null;
    cnpj: string | null;
    ie: string | null;
    ieIndicator: number | null;
    email: string | null;
    phone: string | null;
  } | null;
  address: {
    street: string;
    number: string;
    neighborhood: string;
    city: string;
    state: string;
    zip: string | null;
    complement: string | null;
    ibge: string | null;
  } | null;
  items: NfeItem[];
};

const digits = (v: string | null | undefined) => (v ?? "").replace(/\D/g, "");

// Em homologação a SEFAZ recusa (rejeição 598) destinatário com outro nome.
export const HOMOLOGACAO_NOME = "NF-E EMITIDA EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL";
const cents = (n: number) => Math.round(n * 100);

// Forma de pagamento da NF-e (tPag). Pix do Disk é chave fixa (estático, 20);
// cartão sem saber se é crédito ou débito vai como 99 com descrição; venda a
// prazo vai como crediário (05). Ajustar aqui se o contador pedir outro código.
const PAYMENT_CODES: Record<string, { code: string; label?: string }> = {
  cash: { code: "01" },
  pix: { code: "20" },
  card: { code: "99", label: "Cartão" },
};

/** Ajustes de cadastro que impedem a emissão, em português de balcão. */
export function checkNfe(input: NfeInput): string[] {
  const problems: string[] = [];
  const c = input.customer;
  if (!c) {
    problems.push("O pedido não tem cliente cadastrado. Vincule um cliente ao pedido.");
  } else if (c.type === "PF" && digits(c.cpf).length !== 11) {
    problems.push(`Falta o CPF de ${c.name}. Preencha no cadastro do cliente.`);
  } else if (c.type === "PJ") {
    if (digits(c.cnpj).length !== 14) problems.push(`Falta o CNPJ de ${c.name}.`);
    if (c.ieIndicator === 1 && !digits(c.ie)) problems.push(`${c.name} é contribuinte de ICMS e está sem inscrição estadual.`);
    if (c.ieIndicator == null && !digits(c.ie)) problems.push(`Falta a situação no ICMS de ${c.name} (contribuinte, isento ou não contribuinte).`);
  }

  const a = input.address;
  if (!a) {
    problems.push("O pedido não tem endereço, nem o cliente tem um endereço cadastrado.");
  } else {
    if (digits(a.zip).length !== 8) problems.push("Falta o CEP do endereço.");
    else if (digits(a.ibge).length !== 7) problems.push("Não foi possível achar o município pelo CEP. Confira o CEP do endereço.");
    if (!a.street || !a.number) problems.push("Endereço sem rua ou sem número.");
  }

  if (input.items.length === 0) problems.push("O pedido não tem itens.");
  for (const it of input.items) {
    if (it.unitPrice === null) problems.push(`${it.name}: sem preço no pedido.`);
    if (digits(it.ncm).length !== 8) problems.push(`${it.name}: falta o NCM no cadastro do produto.`);
    if (!it.taxGroup && (digits(it.cfop).length !== 4 || !digits(it.cstCsosn))) {
      problems.push(`${it.name}: falta a tributação (grupo tributário, ou CFOP e CST) no cadastro do produto.`);
    } else if (!it.taxGroup && !digits(it.pisCofinsCst)) {
      problems.push(`${it.name}: falta o CST de PIS/COFINS no cadastro do produto.`);
    }
  }

  const sum = input.items.reduce((s, it) => s + cents((it.unitPrice ?? 0) * it.qty), 0);
  const total = input.totalAmount != null ? cents(input.totalAmount) : sum;
  if (total <= 0) problems.push("O pedido está sem valor.");

  return [...new Set(problems)];
}

/** Payload de /Fiscal/EnviarNotaFiscal. Chame checkNfe antes. */
export function buildNfePayload(input: NfeInput, ambiente: 1 | 2): Record<string, unknown> {
  const c = input.customer!;
  const a = input.address!;
  const gross = input.items.map((it) => cents((it.unitPrice ?? 0) * it.qty));
  const sum = gross.reduce((s, g) => s + g, 0);
  const total = input.totalAmount != null ? cents(input.totalAmount) : sum;

  // Total menor que a soma vira desconto rateado pelos itens; maior vira
  // "outras despesas" no último item. A soma da nota bate com o pedido.
  const discounts = gross.map(() => 0);
  let extra = 0;
  if (total < sum) {
    const diff = sum - total;
    let given = 0;
    gross.forEach((g, i) => {
      discounts[i] = Math.floor((diff * g) / sum);
      given += discounts[i];
    });
    for (let i = gross.length - 1; given < diff && i >= 0; i--) {
      const room = gross[i] - discounts[i];
      const take = Math.min(room, diff - given);
      discounts[i] += take;
      given += take;
    }
  } else if (total > sum) {
    extra = total - sum;
  }

  const isPJ = c.type === "PJ";
  const ieIndicator = isPJ ? (c.ieIndicator ?? (digits(c.ie) ? 1 : 9)) : 9;
  const consumidorFinal = !(isPJ && ieIndicator === 1);
  const pickup = input.fulfillmentType === "pickup";

  const presenca = pickup ? 1
    : input.channel === "site" ? 2
    : input.channel === "ligacao" || input.channel === "whatsapp" ? 3
    : 9;

  const produtos = input.items.map((it, i) => {
    const produto: Record<string, unknown> = {
      CodProdutoServico: it.productId.slice(0, 8).toUpperCase(),
      NmProduto: it.name,
      NCM: digits(it.ncm),
      Quantidade: it.qty,
      UnidadeComercial: it.unidade || "UN",
      ValorUnitario: it.unitPrice ?? 0,
      ValorTotal: gross[i] / 100,
      OrigemProduto: it.origem ?? 0,
    };
    if (digits(it.cest)) produto.CEST = digits(it.cest);
    if (discounts[i]) produto.ValorDesconto = discounts[i] / 100;
    if (extra && i === input.items.length - 1) produto.ValorOutrasDespesas = extra / 100;
    if (it.taxGroup) {
      produto.CodTributacao = it.taxGroup;
    } else {
      produto.CFOP = Number(digits(it.cfop));
      const pisCofins = { CodSituacaoTributaria: digits(it.pisCofinsCst).padStart(2, "0"), Aliquota: 0 };
      produto.Imposto = {
        ICMS: { CodSituacaoTributaria: digits(it.cstCsosn) },
        PIS: pisCofins,
        COFINS: { ...pisCofins },
      };
    }
    return produto;
  });

  const p = input.payment;
  const aPrazo = !!p.dueDate && !p.paidAt;
  const pagamento = (method: string | null, value: number) => {
    if (aPrazo) return { IndicadorPagamento: 1, FormaPagamento: "05", VlPago: value / 100 };
    const m = method ? PAYMENT_CODES[method] : undefined;
    const code = m?.code ?? "99";
    return {
      IndicadorPagamento: 0,
      FormaPagamento: code,
      VlPago: value / 100,
      ...(code === "99" ? { Descricao: m?.label ?? "Não informado" } : {}),
    };
  };
  const split = p.isSplit && p.amount1 && p.amount2 && cents(p.amount1 + p.amount2) === total;
  const pagamentos = split
    ? [pagamento(p.method, cents(p.amount1!)), pagamento(p.method2, cents(p.amount2!))]
    : [pagamento(p.method, total)];

  return {
    TipoAmbiente: ambiente,
    ModeloDocumento: 55,
    Finalidade: 1,
    NaturezaOperacao: "VENDA DE MERCADORIA",
    IndicadorPresenca: presenca,
    ConsumidorFinal: consumidorFinal,
    CalcularIBPT: consumidorFinal,
    IdentificadorInterno: input.orderId,
    EnviarEmail: !!c.email,
    Observacao: `Pedido ${input.orderId.slice(0, 8).toUpperCase()}`,
    Cliente: {
      CpfCnpj: isPJ ? digits(c.cnpj) : digits(c.cpf),
      NmCliente: ambiente === 2 ? HOMOLOGACAO_NOME : (c.legalName?.trim() || c.name),
      IndicadorIe: ieIndicator,
      ...(ieIndicator === 1 ? { Ie: digits(c.ie) } : {}),
      Endereco: {
        Cep: digits(a.zip),
        Logradouro: a.street,
        Numero: a.number,
        ...(a.complement ? { Complemento: a.complement } : {}),
        Bairro: a.neighborhood || "Centro",
        CodMunicipio: digits(a.ibge),
        Municipio: a.city,
        Uf: a.state || "SP",
        CodPais: 1058,
        Pais: "Brasil",
      },
      Contato: {
        ...(digits(c.phone) ? { Telefone: digits(c.phone) } : {}),
        ...(c.email ? { Email: c.email } : {}),
      },
    },
    Produtos: produtos,
    Pagamentos: pagamentos,
    // Entrega com os motoboys do Disk é transporte próprio do remetente (3);
    // retirada na loja não tem transporte (9).
    Transporte: { ModalidadeFrete: pickup ? 9 : 3 },
  };
}

type BrasilNfeErrors = {
  Error?: string;
  Avisos?: string[];
  erros?: { codigo?: string; descricao?: string; correcao?: string }[];
  ReturnNF?: { CodStatusRespostaSefaz?: number; DsStatusRespostaSefaz?: string };
};

/** Junta os motivos de recusa num texto só para mostrar no painel. */
export function describeNfeError(resp: BrasilNfeErrors): string {
  const parts: string[] = [];
  const r = resp.ReturnNF;
  if (r?.DsStatusRespostaSefaz) parts.push(r.CodStatusRespostaSefaz ? `${r.CodStatusRespostaSefaz}: ${r.DsStatusRespostaSefaz}` : r.DsStatusRespostaSefaz);
  if (resp.Error) parts.push(resp.Error);
  for (const e of resp.erros ?? []) {
    parts.push([e.descricao, e.correcao].filter(Boolean).join(" "));
  }
  return [...new Set(parts.filter(Boolean))].join(" · ") || "A Brasil NFe recusou a nota sem dizer o motivo.";
}

/** SEFAZ respondeu "lote em processamento": a nota ainda pode sair autorizada. */
export function isStillProcessing(code: number | undefined): boolean {
  return code === 103 || code === 105;
}
