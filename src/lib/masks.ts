/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Aplica máscara de CPF: 000.000.000-00 (Máximo 14 caracteres)
 */
export const mascaraCPF = (value: string): string => {
  const clean = value.replace(/\D/g, '');
  const limited = clean.slice(0, 11);
  if (limited.length <= 3) return limited;
  if (limited.length <= 6) return `${limited.slice(0, 3)}.${limited.slice(3)}`;
  if (limited.length <= 9) return `${limited.slice(0, 3)}.${limited.slice(3, 6)}.${limited.slice(6)}`;
  return `${limited.slice(0, 3)}.${limited.slice(3, 6)}.${limited.slice(6, 9)}-${limited.slice(9)}`;
};

/**
 * Valida o dígito verificador do CPF
 */
export const validarCPF = (value: string): boolean => {
  const clean = value.replace(/\D/g, '');
  if (clean.length !== 11) return false;
  if (/^(\d)\1+$/.test(clean)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(clean.charAt(i)) * (10 - i);
  }
  let rev = 11 - (sum % 11);
  if (rev === 10 || rev === 11) rev = 0;
  if (rev !== parseInt(clean.charAt(9))) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(clean.charAt(i)) * (11 - i);
  }
  rev = 11 - (sum % 11);
  if (rev === 10 || rev === 11) rev = 0;
  if (rev !== parseInt(clean.charAt(10))) return false;

  return true;
};

/**
 * Valida o dígito verificador do CNPJ
 */
export const validarCNPJ = (value: string): boolean => {
  const clean = value.replace(/\D/g, '');
  if (clean.length !== 14) return false;
  if (/^(\d)\1+$/.test(clean)) return false;

  let tamanho = clean.length - 2;
  let numeros = clean.substring(0, tamanho);
  const digitos = clean.substring(tamanho);
  let soma = 0;
  let pos = tamanho - 7;
  for (let i = tamanho; i >= 1; i--) {
    soma += parseInt(numeros.charAt(tamanho - i), 10) * pos--;
    if (pos < 2) pos = 9;
  }
  let resultado = soma % 11 < 2 ? 0 : 11 - (soma % 11);
  if (resultado !== parseInt(digitos.charAt(0), 10)) return false;

  tamanho = tamanho + 1;
  numeros = clean.substring(0, tamanho);
  soma = 0;
  pos = tamanho - 7;
  for (let i = tamanho; i >= 1; i--) {
    soma += parseInt(numeros.charAt(tamanho - i), 10) * pos--;
    if (pos < 2) pos = 9;
  }
  resultado = soma % 11 < 2 ? 0 : 11 - (soma % 11);
  if (resultado !== parseInt(digitos.charAt(1), 10)) return false;

  return true;
};

/**
 * Valida se é um CPF (11 dígitos) ou CNPJ (14 dígitos) válido
 */
export const validarCPFouCNPJ = (value: string): boolean => {
  const clean = value.replace(/\D/g, '');
  if (clean.length === 11) return validarCPF(clean);
  if (clean.length === 14) return validarCNPJ(clean);
  return false;
};

/**
 * Aplica máscara de CNPJ: 00.000.000/0000-00 (Máximo 18 caracteres)
 */
export const mascaraCNPJ = (value: string): string => {
  const clean = value.replace(/\D/g, '');
  const limited = clean.slice(0, 14);
  if (limited.length <= 2) return limited;
  if (limited.length <= 5) return `${limited.slice(0, 2)}.${limited.slice(2)}`;
  if (limited.length <= 8) return `${limited.slice(0, 2)}.${limited.slice(2, 5)}.${limited.slice(5)}`;
  if (limited.length <= 12) return `${limited.slice(0, 2)}.${limited.slice(2, 5)}.${limited.slice(5, 8)}/${limited.slice(8)}`;
  return `${limited.slice(0, 2)}.${limited.slice(2, 5)}.${limited.slice(5, 8)}/${limited.slice(8, 12)}-${limited.slice(12)}`;
};

/**
 * Aplica máscara de Telefone: (00) 00000-0000 ou (00) 0000-0000 (Máximo 15 caracteres)
 */
export const mascaraTelefone = (value: string): string => {
  const clean = value.replace(/\D/g, '');
  const limited = clean.slice(0, 11);
  if (limited.length === 0) return '';
  if (limited.length <= 2) return `(${limited}`;
  if (limited.length <= 6) return `(${limited.slice(0, 2)}) ${limited.slice(2)}`;
  // Se tiver 10 dígitos (fixo), formato: (XX) XXXX-XXXX. Se tiver 11 dígitos (celular), formato: (XX) XXXXX-XXXX.
  if (limited.length < 11) {
    if (limited.length <= 6) return `(${limited.slice(0, 2)}) ${limited.slice(2)}`;
    return `(${limited.slice(0, 2)}) ${limited.slice(2, 6)}-${limited.slice(6)}`;
  }
  return `(${limited.slice(0, 2)}) ${limited.slice(2, 7)}-${limited.slice(7)}`;
};

/**
 * Aplica máscara de CEP: 00000-000 (Máximo 9 caracteres)
 */
export const mascaraCEP = (value: string): string => {
  const clean = value.replace(/\D/g, '');
  const limited = clean.slice(0, 8);
  if (limited.length <= 5) return limited;
  return `${limited.slice(0, 5)}-${limited.slice(5)}`;
};

/**
 * Aplica máscara de Mês/Ano: 00/00 (Máximo 5 caracteres)
 */
export const mascaraMesAno = (value: string): string => {
  const clean = value.replace(/\D/g, '');
  const limited = clean.slice(0, 4);
  if (limited.length <= 2) return limited;
  return `${limited.slice(0, 2)}/${limited.slice(2)}`;
};

/**
 * Aplica máscara de Conta Bancária: Converte "123456" em "12345-6" ou "123x" em "123-X"
 */
export const maskBankAccount = (value: string): string => {
  // Remove any character that is not a digit or X/x
  const clean = value.replace(/[^0-9Xx]/g, '');
  
  // X/x is only allowed at the very end. Let's filter out any X/x that are not at the end.
  const digits = clean.replace(/[Xx]/g, '');
  const hasXAtEnd = /[Xx]$/.test(clean);
  
  const finalValue = digits + (hasXAtEnd ? clean.charAt(clean.length - 1).toUpperCase() : '');
  
  if (finalValue.length <= 1) {
    return finalValue;
  }
  
  const mainPart = finalValue.slice(0, -1);
  const dv = finalValue.slice(-1);
  return `${mainPart}-${dv}`;
};

/**
 * Remove acentos, caracteres especiais de acentuação e converte para minúsculas.
 */
export const normalizeText = (text: string | null | undefined): string => {
  return text ? text.toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, "") : "";
};

/**
 * Aplica máscara de Altura (metros/centímetros): X,XX m
 */
export const mascaraAltura = (value: string): string => {
  if (value.endsWith(' ')) {
    const clean = value.replace(/\D/g, '');
    if (clean.length <= 1) return clean;
    return `${clean[0]},${clean.slice(1, 3)}`;
  }
  
  const clean = value.replace(/\D/g, '');
  if (clean.length === 0) return '';
  if (clean.length === 1) return clean;
  if (clean.length === 2) {
    return `${clean[0]},${clean[1]} m`;
  }
  const limited = clean.slice(0, 3);
  return `${limited[0]},${limited.slice(1)} m`;
};

/**
 * Aplica máscara de Peso: XX kg ou XXX kg
 */
export const mascaraPeso = (value: string): string => {
  if (value.endsWith(' ')) {
    const clean = value.replace(/\D/g, '');
    return clean.slice(0, 3);
  }
  
  const clean = value.replace(/\D/g, '');
  if (clean.length === 0) return '';
  const limited = clean.slice(0, 3);
  return `${limited} kg`;
};

/**
 * Converte qualquer valor para string no formato de moeda brasileiro (ex: 160,00)
 */
export const formatarMoeda = (value: number | string | undefined | null): string => {
  if (value === undefined || value === null || value === '') return '';
  const num = typeof value === 'number' ? value : parseFloat(value.toString().replace(/\./g, '').replace(',', '.'));
  if (isNaN(num)) return '';
  return num.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

/**
 * Aplica máscara financeira em tempo de digitação (ex: 16000 -> 160,00)
 */
export const mascaraFinanceira = (value: string): string => {
  const clean = value.replace(/\D/g, '');
  if (!clean) return '';
  
  const centavos = parseInt(clean, 10);
  const reais = centavos / 100;
  
  return reais.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

/**
 * Sugere data de vencimento padrão (dia 05 do mês subsequente ou D+5 dias úteis)
 */
export const getSugestaoVencimento = (): string => {
  const hoje = new Date();
  let mes = hoje.getMonth() + 1; // próximo mês
  let ano = hoje.getFullYear();
  if (mes > 11) {
    mes = 0;
    ano += 1;
  }
  const d05 = new Date(ano, mes, 5);
  const iso05 = d05.toISOString().split('T')[0];
  const hojeIso = hoje.toISOString().split('T')[0];
  if (iso05 >= hojeIso) {
    return iso05;
  }
  const d5 = new Date();
  d5.setDate(d5.getDate() + 5);
  return d5.toISOString().split('T')[0];
};
export const converterMascaraParaNumero = (value: string | number | undefined | null): number => {
  if (value === undefined || value === null || value === '') return 0;
  if (typeof value === 'number') return value;
  
  const clean = value.replace(/\./g, '').replace(',', '.');
  const num = parseFloat(clean);
  return isNaN(num) ? 0 : num;
};



