import { describe, it, expect } from "vitest";
import { isValidCpf, maskCpf } from "@/lib/cpf";

describe("cpf", () => {
  it("aceita CPF com dígitos corretos, com ou sem máscara", () => {
    expect(isValidCpf("529.982.247-25")).toBe(true);
    expect(isValidCpf("52998224725")).toBe(true);
  });

  it("recusa dígito errado, tamanho errado e números repetidos", () => {
    expect(isValidCpf("529.982.247-24")).toBe(false);
    expect(isValidCpf("5299822472")).toBe(false);
    expect(isValidCpf("111.111.111-11")).toBe(false);
  });

  it("aplica a máscara enquanto digita", () => {
    expect(maskCpf("529")).toBe("529");
    expect(maskCpf("5299822")).toBe("529.982.2");
    expect(maskCpf("52998224725")).toBe("529.982.247-25");
    expect(maskCpf("529982247259999")).toBe("529.982.247-25");
  });
});
