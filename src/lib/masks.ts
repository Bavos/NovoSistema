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
