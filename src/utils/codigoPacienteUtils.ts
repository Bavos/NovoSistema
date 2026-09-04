/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Paciente } from '../types';

/**
 * Localiza o maior valor numérico presente no campo codigoReferencia entre todos os pacientes carregados.
 * Piso Mínimo: Se o maior número encontrado for menor que 202 (ou se nenhum paciente possuir código preenchido), adote como base o número 202.
 * Calcule o próximo valor: maiorNumero + 1 (ex: se a base for 202, o próximo será 203).
 * Formate com zeros à esquerda com 5 dígitos (ex: 00203).
 *
 * @param pacientes Lista de pacientes carregados
 * @returns Código de referência formatado com 5 dígitos (ex: '00203')
 */
export function getProximoCodigoReferencia(
  pacientes?: (Paciente | { codigoReferencia?: string })[] | null
): string {
  let maiorNumero = 202; // Piso mínimo inicial

  if (Array.isArray(pacientes)) {
    for (const p of pacientes) {
      if (p && p.codigoReferencia) {
        // Extrai apenas os dígitos numéricos da string
        const digitos = String(p.codigoReferencia).replace(/\D/g, '');
        if (digitos.length > 0) {
          const num = parseInt(digitos, 10);
          if (!isNaN(num) && num > maiorNumero) {
            maiorNumero = num;
          }
        }
      }
    }
  }

  const proximoValor = maiorNumero + 1;
  return String(proximoValor).padStart(5, '0');
}
