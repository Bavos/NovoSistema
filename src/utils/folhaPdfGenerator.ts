import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  formatNomeComEspacos,
  formatDateBR,
  formatCurrency,
  getPlantaoCargaHoraria,
} from './faturaPdfGenerator';

/**
 * Converte data para timestamp numérico para ordenação cronológica dos plantões.
 */
const parseDateToTimestamp = (dateStr: string): number => {
  if (!dateStr) return 0;
  if (dateStr.includes('-')) {
    const parts = dateStr.split('-');
    if (parts.length >= 3) {
      return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2].substring(0, 2))).getTime();
    }
  } else if (dateStr.includes('/')) {
    const parts = dateStr.split('/');
    if (parts.length >= 3) {
      return new Date(Number(parts[2].substring(0, 4)), Number(parts[1]) - 1, Number(parts[0])).getTime();
    }
  }
  return new Date(dateStr).getTime() || 0;
};

/**
 * Calcula o valor do plantão devido ao profissional na folha.
 * Considera valor base (ou valorProfissional), multiplicador de feriado e ajuda de custo.
 */
export const getFolhaPlantaoVal = (p: any): number => {
  const base = Number(p.valorProfissional ?? p.valorPlantao ?? 0);
  const ajuda = Number(p.ajudaCusto || 0);
  let mult = 1.0;
  if (p.tipoDia === 'Feriado 20%') mult = 1.2;
  else if (p.tipoDia === 'Feriado 50%') mult = 1.5;
  return (base * mult) + ajuda;
};

/**
 * Formata descrição do serviço prestado e carga horária na linha da folha.
 */
export const formatServicoCargaHoraria = (p: any): string => {
  const carga = getPlantaoCargaHoraria(p);
  const tipoDia = p.tipoDia || '';
  let baseServico = p.descricaoServico || p.servico || p.tipoServico || `Plantão ${carga}`;

  // Se a descrição ainda não incluir a carga horária e esta for válida, anexa
  if (!baseServico.includes(carga) && carga) {
    baseServico = `${baseServico} (${carga})`;
  }

  if (tipoDia && tipoDia !== 'Normal') {
    return `${baseServico} - ${tipoDia}`;
  }
  return baseServico;
};

/**
 * Formata o período apurado garantindo formato brasileiro limpo (ex: MM/AAAA ou DD/MM/AAAA a DD/MM/AAAA).
 */
export const formatPeriodoApurado = (periodo: any, plantoes?: any[]): string => {
  if (typeof periodo === 'string' && periodo.trim()) {
    const pStr = periodo.trim();
    if (pStr.includes(' a ')) {
      const [ini, fim] = pStr.split(' a ');
      return `${formatDateBR(ini)} a ${formatDateBR(fim)}`;
    }
    if (pStr.includes(' - ')) {
      const [ini, fim] = pStr.split(' - ');
      return `${formatDateBR(ini)} a ${formatDateBR(fim)}`;
    }
    const yyyyMm = pStr.match(/^(\d{4})-(\d{2})$/);
    if (yyyyMm) {
      return `${yyyyMm[2]}/${yyyyMm[1]}`;
    }
    return formatDateBR(pStr);
  }
  if (periodo && typeof periodo === 'object') {
    if (periodo.inicio && periodo.fim) {
      return `${formatDateBR(periodo.inicio)} a ${formatDateBR(periodo.fim)}`;
    }
    if (periodo.mes && periodo.ano) {
      return `${String(periodo.mes).padStart(2, '0')}/${periodo.ano}`;
    }
  }
  if (Array.isArray(plantoes) && plantoes.length > 0) {
    const validDates = plantoes
      .map((p) => p.data)
      .filter(Boolean)
      .sort((a, b) => parseDateToTimestamp(a) - parseDateToTimestamp(b));
    if (validDates.length > 0) {
      const first = formatDateBR(validDates[0]);
      const last = formatDateBR(validDates[validDates.length - 1]);
      return first === last ? first : `${first} a ${last}`;
    }
  }
  const now = new Date();
  return `${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
};

/**
 * Gera e exporta o documento de Folha de Pagamento Individual em PDF 100% nativo e vetorial usando jsPDF e autoTable,
 * aplicando com rigor o mesmo design limpo, sóbrio e corporativo da Fatura da Vallidare.
 */
export const exportFolhaPDF = async (folhaData: any, empresaInfo?: any): Promise<jsPDF> => {
  if (!folhaData) {
    throw new Error('Dados da folha de pagamento não informados.');
  }

  // 1. Inicializa documento A4 Retrato com margens laterais de 14mm
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = 210;
  const marginX = 14;
  const contentWidth = pageWidth - (marginX * 2); // 182mm
  const rightX = marginX + contentWidth; // 196mm

  // 2. Extração e sanitização dos dados da folha
  const rawProfissionalNome = folhaData.nomeProfissional || folhaData.profissionalNome || folhaData.profissional || 'Profissional';
  const nomeProfissional = formatNomeComEspacos(rawProfissionalNome);

  // Número da Folha formatado (ex: FOL-XXXXXX-XXXX ou FOL-0001)
  let numeroFolha = String(folhaData.numeroFolha || folhaData.numero || '').trim();
  if (!numeroFolha) {
    numeroFolha = folhaData.id ? `FOL-${String(folhaData.id).slice(-8).toUpperCase()}` : 'FOL-0001';
  } else if (!numeroFolha.toUpperCase().startsWith('FOL-')) {
    numeroFolha = `FOL-${numeroFolha}`;
  }

  const dataEmissao = formatDateBR(folhaData.dataEmissao);

  // Status da folha formatado (Fechada / Aberta)
  const rawStatus = String(folhaData.status || 'Fechada').trim().toLowerCase();
  let statusFormatado = 'Fechada';
  if (rawStatus.includes('abert') || rawStatus.includes('pendent')) {
    statusFormatado = 'Aberta';
  } else if (rawStatus.includes('cancel')) {
    statusFormatado = 'Cancelada';
  } else {
    statusFormatado = 'Fechada';
  }

  // Plantões válidos (exclui faltas e cancelados)
  const plantoesOriginais = folhaData.plantoesCongelados || folhaData.plantoes || folhaData.itens || [];
  const plantoesValidos = (Array.isArray(plantoesOriginais) ? plantoesOriginais : [])
    .filter((p: any) => {
      if (!p) return false;
      if (p.considerarFalta || p.status === 'falta' || p.status === 'Falta' || p.status === 'Cancelado' || p.status === 'cancelado') {
        return false;
      }
      const val = getFolhaPlantaoVal(p);
      return val > 0;
    })
    .sort((a: any, b: any) => parseDateToTimestamp(a.data) - parseDateToTimestamp(b.data));

  const periodoApuradoFormatado = formatPeriodoApurado(folhaData.periodoApurado, plantoesValidos);

  // Cálculos financeiros da Folha
  const totalSomaPlantoes = plantoesValidos.reduce((acc: number, curr: any) => acc + getFolhaPlantaoVal(curr), 0);
  const totalDebitos = Number(folhaData.valorTotalDebitos || 0) || (Array.isArray(folhaData.historicoDebitos) ? folhaData.historicoDebitos.reduce((acc: number, d: any) => acc + (Number(d.valor) || 0), 0) : 0);
  const valorLiquidoFinal = Number(folhaData.valorLiquidoReceber) || (totalSomaPlantoes - totalDebitos);

  // =========================================================================
  // 1. CABEÇALHO SUPERIOR (Duas Colunas)
  // =========================================================================
  // Lado Esquerdo:
  // Vallidare Gestão Médica e Auditoria EIRELI (Negrito, 12pt)
  // CNPJ: 27.770.797/0001-62 (Normal, 9pt)
  // Endereço: Rua Martins Ferreira, 71 - Botafogo / Rio de Janeiro (Normal, 9pt)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(30, 41, 59); // #1e293b
  const razaoSocialEmpresa = (empresaInfo?.razaoSocial && !/VALUDARE|VALLIOARE|EIREU/i.test(empresaInfo.razaoSocial))
    ? empresaInfo.razaoSocial.replace(/\s+/g, ' ').trim()
    : 'Vallidare Gestão Médica e Auditoria EIRELI';
  doc.text(razaoSocialEmpresa, marginX, 18);

  const cnpjEmpresa = empresaInfo?.cnpj || '27.770.797/0001-62';
  const enderecoEmpresa = empresaInfo?.endereco || 'Rua Martins Ferreira, 71 - Botafogo / Rio de Janeiro';

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105); // #475569
  doc.text(`CNPJ: ${cnpjEmpresa}`, marginX, 23);
  doc.text(`Endereço: ${enderecoEmpresa}`, marginX, 27.5);

  // Lado Direito:
  // FOLHA DE PAGAMENTO (Negrito, 14pt, alinhado à direita)
  // Nº: FOL-XXXXXX-XXXX (Normal, 10pt, alinhado à direita)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(30, 41, 59); // #1e293b
  doc.text('FOLHA DE PAGAMENTO', rightX, 18, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(71, 85, 105); // #475569
  doc.text(`Nº: ${numeroFolha}`, rightX, 24, { align: 'right' });

  // Linha divisória sutil inferior (#e2e8f0)
  doc.setDrawColor(226, 232, 240); // #e2e8f0
  doc.setLineWidth(0.4);
  doc.line(marginX, 32, rightX, 32);

  // =========================================================================
  // 2. QUADRO: "DADOS DA FOLHA E PROFISSIONAL"
  // =========================================================================
  // Título da seção: DADOS DA FOLHA E PROFISSIONAL (Negrito, 9.5pt, caixa alta)
  const quadroTitleY = 38;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(30, 41, 59); // #1e293b
  doc.text('DADOS DA FOLHA E PROFISSIONAL', marginX, quadroTitleY);

  // Caixa de dados dividida em duas colunas
  const boxY = quadroTitleY + 3; // 41mm
  const boxHeight = 22; // 22mm
  doc.setFillColor(248, 250, 252); // #f8fafc
  doc.setDrawColor(226, 232, 240); // #e2e8f0
  doc.setLineWidth(0.3);
  doc.roundedRect(marginX, boxY, contentWidth, boxHeight, 1.5, 1.5, 'FD');

  const colLeftX = marginX + 4;
  const colRightX = marginX + (contentWidth / 2) + 2;

  // Coluna Esquerda:
  // Emissão: DD/MM/AAAA (data limpa, formato brasileiro)
  // Profissional: [Nome Completo do Profissional]
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text('Emissão: ', colLeftX, boxY + 6.5);
  const emissaoLabelWidth = doc.getTextWidth('Emissão: ');
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(30, 41, 59);
  doc.text(dataEmissao, colLeftX + emissaoLabelWidth, boxY + 6.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text('Profissional: ', colLeftX, boxY + 14.5);
  const profLabelWidth = doc.getTextWidth('Profissional: ');
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);

  let nomeExibicao = nomeProfissional;
  const maxNomeWidth = (contentWidth / 2) - 8 - profLabelWidth;
  if (doc.getTextWidth(nomeExibicao) > maxNomeWidth) {
    while (nomeExibicao.length > 3 && doc.getTextWidth(nomeExibicao + '...') > maxNomeWidth) {
      nomeExibicao = nomeExibicao.slice(0, -1);
    }
    nomeExibicao += '...';
  }
  doc.text(nomeExibicao, colLeftX + profLabelWidth, boxY + 14.5);

  // Coluna Direita:
  // Status: [Fechada / Aberta]
  // Período Apurado: MM/AAAA (ou DD/MM/AAAA a DD/MM/AAAA)
  // Valor Líquido: R$ X.XXX,XX (em negrito de destaque)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text('Status: ', colRightX, boxY + 5.5);
  const statusLabelWidth = doc.getTextWidth('Status: ');
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(30, 41, 59);
  doc.text(statusFormatado, colRightX + statusLabelWidth, boxY + 5.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text('Período Apurado: ', colRightX, boxY + 11.5);
  const periodoLabelWidth = doc.getTextWidth('Período Apurado: ');
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(30, 41, 59);
  doc.text(periodoApuradoFormatado, colRightX + periodoLabelWidth, boxY + 11.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text('Valor Líquido: ', colRightX, boxY + 17.5);
  const valorLabelWidth = doc.getTextWidth('Valor Líquido: ');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  doc.text(formatCurrency(valorLiquidoFinal), colRightX + valorLabelWidth, boxY + 17.5);

  // =========================================================================
  // 3. TABELA: "DETALHAMENTO DE PLANTÕES PRESTADOS"
  // =========================================================================
  // Título da seção: DETALHAMENTO DE PLANTÕES PRESTADOS (Negrito, 9.5pt, caixa alta)
  const tabelaTitleY = boxY + boxHeight + 6.5; // 69.5mm
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(30, 41, 59); // #1e293b
  doc.text('DETALHAMENTO DE PLANTÕES PRESTADOS', marginX, tabelaTitleY);

  // Linhas de dados da tabela
  const tableRows: any[] = plantoesValidos.map((p: any) => {
    const dataStr = formatDateBR(p.data);
    const pacienteStr = formatNomeComEspacos(p.paciente || p.nomePaciente || 'Paciente');
    const servicoStr = formatServicoCargaHoraria(p);
    const valorNum = getFolhaPlantaoVal(p);
    const valorStr = formatCurrency(valorNum);

    return [dataStr, pacienteStr, servicoStr, valorStr];
  });

  // Fallback caso não haja nenhum plantão
  const finalBody = tableRows.length > 0 ? tableRows : [['-', 'Nenhum plantão registrado no período', '-', 'R$ 0,00']];

  // Fechamento no rodapé da tabela:
  // Se houver débitos: linha com DÉBITOS / DESCONTOS e valor em vermelho - R$ XX,XX.
  // Linha final mesclada (colSpan: 3): TOTAL LÍQUIDO A RECEBER com o valor líquido final em destaque à direita.
  const footRows: any[] = [];

  if (totalDebitos > 0) {
    // Linha de subtotal bruto dos plantões para transparência de cálculo
    footRows.push([
      {
        content: 'SUBTOTAL PLANTÕES',
        colSpan: 3,
        styles: {
          halign: 'right',
          fontStyle: 'bold',
          fontSize: 8,
          textColor: [71, 85, 105],
          cellPadding: { top: 3, bottom: 3, left: 3, right: 4 },
        },
      },
      {
        content: formatCurrency(totalSomaPlantoes),
        styles: {
          halign: 'right',
          fontStyle: 'bold',
          fontSize: 8,
          textColor: [30, 41, 59],
          cellPadding: { top: 3, bottom: 3, left: 3, right: 3 },
        },
      },
    ]);

    // Linha de DÉBITOS / DESCONTOS com valor em vermelho - R$ XX,XX
    footRows.push([
      {
        content: 'DÉBITOS / DESCONTOS',
        colSpan: 3,
        styles: {
          halign: 'right',
          fontStyle: 'bold',
          fontSize: 8,
          textColor: [185, 28, 28], // #b91c1c (vermelho)
          cellPadding: { top: 3, bottom: 3, left: 3, right: 4 },
        },
      },
      {
        content: `- ${formatCurrency(totalDebitos)}`,
        styles: {
          halign: 'right',
          fontStyle: 'bold',
          fontSize: 8,
          textColor: [185, 28, 28], // #b91c1c (vermelho)
          cellPadding: { top: 3, bottom: 3, left: 3, right: 3 },
        },
      },
    ]);
  }

  // Linha final mesclada (colSpan: 3): TOTAL LÍQUIDO A RECEBER com o valor líquido final em destaque à direita
  footRows.push([
    {
      content: 'TOTAL LÍQUIDO A RECEBER',
      colSpan: 3,
      styles: {
        halign: 'right',
        fontStyle: 'bold',
        fontSize: 8.5,
        textColor: [30, 41, 59],
        cellPadding: { top: 3.5, bottom: 3.5, left: 3, right: 4 },
      },
    },
    {
      content: formatCurrency(valorLiquidoFinal),
      styles: {
        halign: 'right',
        fontStyle: 'bold',
        fontSize: 8.5,
        textColor: [30, 41, 59],
        cellPadding: { top: 3.5, bottom: 3.5, left: 3, right: 3 },
      },
    },
  ]);

  // Tabela via autoTable com 4 colunas proporcionais:
  // Data (~25mm, centralizada)
  // Paciente (livre / expande, alinhamento à esquerda)
  // Serviço / Carga Horária (~45mm, alinhamento à esquerda)
  // Valor (~30mm, alinhamento à direita)
  autoTable(doc, {
    startY: tabelaTitleY + 3.5, // 73mm
    head: [['Data', 'Paciente', 'Serviço / Carga Horária', 'Valor']],
    body: finalBody,
    foot: footRows,
    theme: 'plain',
    styles: {
      font: 'helvetica',
      fontSize: 8,
      cellPadding: { top: 3.2, bottom: 3.2, left: 3, right: 3 },
      textColor: [30, 41, 59],
      lineColor: [226, 232, 240],
      lineWidth: { bottom: 0.2 },
      overflow: 'linebreak',
    },
    headStyles: {
      fillColor: [241, 245, 249], // #f1f5f9
      textColor: [30, 41, 59],
      font: 'helvetica',
      fontStyle: 'bold',
      fontSize: 8.5,
      cellPadding: { top: 3.5, bottom: 3.5, left: 3, right: 3 },
      lineColor: [203, 213, 225],
      lineWidth: { top: 0.4, bottom: 0.4 },
    },
    footStyles: {
      fillColor: [248, 250, 252], // #f8fafc
      lineColor: [203, 213, 225],
      lineWidth: { top: 0.4, bottom: 0.4 },
    },
    columnStyles: {
      0: { cellWidth: 25, halign: 'center' },
      1: { cellWidth: 'auto', halign: 'left' },
      2: { cellWidth: 45, halign: 'left' },
      3: { cellWidth: 30, halign: 'right' },
    },
    margin: { left: marginX, right: marginX, bottom: 18 },
    alternateRowStyles: {
      fillColor: [252, 253, 254],
    },
  });

  // =========================================================================
  // 4. RODAPÉ
  // =========================================================================
  // Centralizado no final da página: Documento gerado pelo Sistema RH de Gestão • Página X de Y (Cinza, 8pt)
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(156, 163, 175); // Cinza claro #9ca3af
    doc.text(
      `Documento gerado pelo Sistema RH de Gestão • Página ${i} de ${totalPages}`,
      pageWidth / 2,
      288,
      { align: 'center' }
    );
  }

  // Salva o PDF com nome amigável e higienizado
  const safeNome = nomeProfissional.replace(/[^a-zA-Z0-9à-úÀ-Ú_]/g, '_');
  const safeData = dataEmissao.replace(/\//g, '-');
  const fileName = `Folha_${safeNome}_${safeData}.pdf`;

  doc.save(fileName);
  return doc;
};
