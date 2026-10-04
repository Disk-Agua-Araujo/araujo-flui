export type CepAddress = {
  street: string;
  neighborhood: string;
  city: string;
  state: string;
  /** Código IBGE do município, exigido no endereço da NF-e. */
  ibge: string;
};

/** Consulta o CEP no ViaCEP. Devolve null para CEP inexistente ou falha de rede. */
export async function lookupCep(cep: string): Promise<CepAddress | null> {
  const digits = cep.replace(/\D/g, "");
  if (digits.length !== 8) return null;
  try {
    const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.erro) return null;
    return {
      street: data.logradouro ?? "",
      neighborhood: data.bairro ?? "",
      city: data.localidade ?? "",
      state: data.uf ?? "",
      ibge: data.ibge ?? "",
    };
  } catch {
    return null;
  }
}
