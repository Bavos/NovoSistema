/**
 * Utilitários para tratamento, normalização e conversão de datas (ISO <-> Padrão Brasileiro)
 * para o gateway da API interna da RH Gestão Domiciliar.
 */

/**
 * Normaliza qualquer formato comum de data (YYYY-MM-DD, DD/MM/YYYY, YYYY-MM, MM/YYYY)
 * para o formato desejado (ISO ou BR).
 */
export function normalizeDate(
  input: string | undefined | null,
  targetFormat: 'ISO' | 'BR' = 'ISO'
): string | undefined {
  if (!input) return undefined;
  const trimmed = input.trim();
  if (!trimmed) return undefined;

  // Caso 1: YYYY-MM-DD
  const isoFullMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoFullMatch) {
    const [, year, month, day] = isoFullMatch;
    return targetFormat === 'BR' ? `${day}/${month}/${year}` : `${year}-${month}-${day}`;
  }

  // Caso 2: DD/MM/YYYY ou DD-MM-YYYY
  const brFullMatch = trimmed.match(/^(\d{2})[/-](\d{2})[/-](\d{4})$/);
  if (brFullMatch) {
    const [, day, month, year] = brFullMatch;
    return targetFormat === 'BR' ? `${day}/${month}/${year}` : `${year}-${month}-${day}`;
  }

  // Caso 3: YYYY-MM (competência)
  const isoMonthMatch = trimmed.match(/^(\d{4})-(\d{2})$/);
  if (isoMonthMatch) {
    const [, year, month] = isoMonthMatch;
    return targetFormat === 'BR' ? `${month}/${year}` : `${year}-${month}`;
  }

  // Caso 4: MM/YYYY ou MM-YYYY (competência BR)
  const brMonthMatch = trimmed.match(/^(\d{2})[/-](\d{4})$/);
  if (brMonthMatch) {
    const [, month, year] = brMonthMatch;
    return targetFormat === 'BR' ? `${month}/${year}` : `${year}-${month}`;
  }

  // Se não bater com regex, devolve como string limpa
  return trimmed;
}

/**
 * Converte data para string amigável em português (ex: "06/11/2026" ou "06 de Novembro de 2026")
 */
export function formatFriendlyDate(input: string | undefined): string {
  if (!input) return '';
  const iso = normalizeDate(input, 'ISO');
  if (!iso || !iso.includes('-')) return input;

  const parts = iso.split('-');
  if (parts.length === 3) {
    const [year, month, day] = parts;
    const months = [
      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];
    const monthName = months[parseInt(month, 10) - 1] || month;
    return `${day} de ${monthName} de ${year}`;
  }

  if (parts.length === 2) {
    const [year, month] = parts;
    const months = [
      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];
    const monthName = months[parseInt(month, 10) - 1] || month;
    return `${monthName} de ${year}`;
  }

  return input;
}

/**
 * Divide uma mensagem longa em múltiplos blocos respeitando o limite do Telegram (4.096 chars).
 * Usa safeLimit default de 4.000 chars e tenta quebrar em parágrafos ou quebras de linha.
 */
export function splitTelegramMessage(text: string, safeLimit: number = 4000): string[] {
  if (!text || text.length <= safeLimit) {
    return [text];
  }

  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > safeLimit) {
    // Procura a última quebra de parágrafo dentro do limite
    let splitIndex = remaining.lastIndexOf('\n\n', safeLimit);

    // Se não houver parágrafo duplo, procura uma quebra de linha simples
    if (splitIndex === -1 || splitIndex < safeLimit * 0.5) {
      splitIndex = remaining.lastIndexOf('\n', safeLimit);
    }

    // Se não houver quebra de linha razoável, procura o último espaço
    if (splitIndex === -1 || splitIndex < safeLimit * 0.5) {
      splitIndex = remaining.lastIndexOf(' ', safeLimit);
    }

    // Se nem espaço encontrou, corta no limite máximo
    if (splitIndex === -1 || splitIndex <= 0) {
      splitIndex = safeLimit;
    }

    const chunk = remaining.substring(0, splitIndex).trim();
    if (chunk.length > 0) {
      chunks.push(chunk);
    }
    remaining = remaining.substring(splitIndex).trim();
  }

  if (remaining.length > 0) {
    chunks.push(remaining);
  }

  return chunks;
}
