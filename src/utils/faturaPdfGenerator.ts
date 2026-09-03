import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

/**
 * Normaliza e formata nomes próprios, separando palavras coladas em camelCase
 * e removendo caracteres invisíveis ou espaços duplicados.
 */
export const formatNomeComEspacos = (nome: any): string => {
  if (!nome || typeof nome !== 'string') return 'A Definir';
  return String(nome)
    .replace(/[\u0000-\u001F\u007F-\u009F\u00A0\u1680\u180e\u2000-\u200b\u202f\u205f\u3000\ufeff]/g, ' ')
    .replace(/([a-zà-ú0-9])([A-ZÀ-Ú])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim() || 'A Definir';
};

/**
 * Converte diferentes formatos de data para DD/MM/AAAA.
 */
export const formatDateBR = (dateVal: any): string => {
  if (!dateVal) return '';
  if (typeof dateVal === 'object' && typeof dateVal.toDate === 'function') {
    try {
      const d = dateVal.toDate();
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      return `${day}/${month}/${year}`;
    } catch {}
  }
  const str = String(dateVal).trim();
  const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    return `${isoMatch[3]}/${isoMatch[2]}/${isoMatch[1]}`;
  }
  const brMatch = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (brMatch) {
    return `${brMatch[1].padStart(2, '0')}/${brMatch[2].padStart(2, '0')}/${brMatch[3]}`;
  }
  try {
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      return `${day}/${month}/${year}`;
    }
  } catch {}
  return str;
};

/**
 * Converte data para timestamp numérico para ordenação.
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
 * Calcula o valor bruto/cobrado da linha de plantão na fatura.
 */
export const getFaturaRowVal = (p: any): number => {
  const base = Number(p.valorPlantao || 0);
  const adm = Number(p.taxaAdm || 0);
  const ajuda = Number(p.ajudaCusto || 0);
  let mult = 1.0;
  if (p.tipoDia === 'Feriado 20%') mult = 1.2;
  else if (p.tipoDia === 'Feriado 50%') mult = 1.5;
  return (base * mult) + (adm * mult) + ajuda;
};

/**
 * Retorna a carga horária em formato compacto (ex: 12h, 24h, 6h).
 */
export const getPlantaoCargaHoraria = (s: any): string => {
  const explicit = s?.tipoEscala || s?.cargaHoraria || s?.duracao;
  if (explicit && typeof explicit === 'string') {
    if (explicit.includes('24h') || explicit.includes('24')) return '24h';
    if (explicit.includes('12h') || explicit.includes('12')) return '12h';
    if (explicit.includes('48h') || explicit.includes('48')) return '48h';
    if (explicit.includes('6h') || explicit.includes('6')) return '6h';
  }

  const horarioStr = s?.horario || '';
  if (horarioStr.includes('24h')) return '24h';
  if (horarioStr.includes('12h')) return '12h';
  if (horarioStr.includes('48h')) return '48h';
  if (horarioStr.includes('6h')) return '6h';

  const timeMatch = horarioStr.match(/(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/);
  if (timeMatch) {
    const startH = parseInt(timeMatch[1], 10);
    const startM = parseInt(timeMatch[2], 10);
    const endH = parseInt(timeMatch[3], 10);
    const endM = parseInt(timeMatch[4], 10);

    let diffMinutes = (endH * 60 + endM) - (startH * 60 + startM);
    if (diffMinutes <= 0) {
      diffMinutes += 24 * 60;
    }
    const hours = Math.round(diffMinutes / 60);
    return `${hours}h`;
  }

  return '12h';
};

/**
 * Formata valores monetários em padrão Real Brasileiro (R$ 1.234,56).
 */
export const formatCurrency = (val: number): string => {
  return `R$ ${(Number(val) || 0).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

/**
 * Gera e exporta o documento de Fatura do Paciente em PDF 100% nativo e vetorial usando jsPDF e autoTable.
 * Elimina totalmente dependência de html2canvas, garantindo nitidez máxima, sem cortes e sem aglutinações.
 */
export const exportFaturaPDF = async (faturaData: any, empresaInfo?: any): Promise<jsPDF> => {
  if (!faturaData) {
    throw new Error('Dados da fatura não informados.');
  }

  // 1. Inicializa documento A4 Retrato com margens de 14mm
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const marginX = 14;
  const contentWidth = pageWidth - (marginX * 2); // 182mm
  const rightX = marginX + contentWidth; // 196mm

  // 2. Extração e sanitização de dados da fatura
  const rawPacienteNome = faturaData.nomePaciente || faturaData.pacienteNome || faturaData.paciente || 'Paciente';
  const nomePaciente = formatNomeComEspacos(rawPacienteNome);

  const numeroFatura = faturaData.numeroFatura || faturaData.numero || 'FAT-0000';
  const dataEmissao = faturaData.dataEmissao ? formatDateBR(faturaData.dataEmissao) : new Date().toLocaleDateString('pt-BR');
  const statusFatura = String(faturaData.status || 'Emitida').trim();

  // Plantões válidos (exclui cancelados e faltas)
  const plantoesOriginais = faturaData.plantoesCongelados || faturaData.plantoes || faturaData.itens || [];
  const plantoesValidos = (Array.isArray(plantoesOriginais) ? plantoesOriginais : [])
    .filter((p: any) => {
      if (!p) return false;
      if (p.considerarFalta || p.status === 'falta' || p.status === 'Falta' || p.status === 'Cancelado' || p.status === 'cancelado') {
        return false;
      }
      const val = getFaturaRowVal(p);
      return val > 0;
    })
    .sort((a: any, b: any) => parseDateToTimestamp(a.data) - parseDateToTimestamp(b.data));

  // Serviços adicionais / materiais
  const servicosExtras = Array.isArray(faturaData.servicosExtras) ? faturaData.servicosExtras : [];
  const somaExtras = servicosExtras.reduce((acc: number, curr: any) => acc + (Number(curr.valor) || 0), 0);
  const totalSomaPlantoes = plantoesValidos.reduce((acc: number, curr: any) => acc + getFaturaRowVal(curr), 0);

  const valorTotalFinal = Number(faturaData.valorTotal || faturaData.valorTotalFatura) || (totalSomaPlantoes + somaExtras);

  // Período apurado
  let periodoTexto = 'Período Mensal';
  if (faturaData.periodoApurado?.inicio && faturaData.periodoApurado?.fim) {
    periodoTexto = `${formatDateBR(faturaData.periodoApurado.inicio)} a ${formatDateBR(faturaData.periodoApurado.fim)}`;
  } else if (plantoesValidos.length > 0) {
    const inicioData = plantoesValidos[0].data;
    const fimData = plantoesValidos[plantoesValidos.length - 1].data;
    periodoTexto = `${formatDateBR(inicioData)} a ${formatDateBR(fimData)}`;
  } else if (faturaData.mesReferencia) {
    periodoTexto = faturaData.mesReferencia;
  }

  // 3. Cabeçalho Institucional (Topo)
  // Lado Esquerdo: Identificação Corporativa
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(30, 41, 59); // #1e293b
  doc.text('VALLIDARE', marginX, 17);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139); // #64748b
  doc.text('Gestão e Consultoria em Saúde', marginX, 21.5);

  const razaoSocialEmpresa = (empresaInfo?.razaoSocial && !/VALUDARE|VALLIOARE|EIREU/i.test(empresaInfo.razaoSocial))
    ? empresaInfo.razaoSocial.replace(/\s+/g, ' ').trim()
    : 'VALLIDARE GESTÃO MÉDICA E AUDITORIA EIRELI';

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105); // #475569
  doc.text(razaoSocialEmpresa, marginX, 26);

  const cnpjEmpresa = empresaInfo?.cnpj || '27.770.797/0001-62';
  const enderecoEmpresa = empresaInfo?.endereco || 'Rua Martins Ferreira, 71 - Botafogo / Rio de Janeiro';

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139); // #64748b
  doc.text(`CNPJ: ${cnpjEmpresa} • ${enderecoEmpresa}`, marginX, 30);

  // Lado Direito: Dados da Fatura
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(30, 41, 59); // #1e293b
  doc.text('FATURA', rightX, 17, { align: 'right' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105); // #475569
  doc.text(`Nº: ${numeroFatura}`, rightX, 22.5, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105); // #475569
  doc.text(`Emissão: ${dataEmissao}`, rightX, 27.5, { align: 'right' });

  // Linha divisória horizontal sutil (#e2e8f0, espessura 0.5mm)
  doc.setDrawColor(226, 232, 240); // #e2e8f0
  doc.setLineWidth(0.5);
  doc.line(marginX, 33.5, rightX, 33.5);

  // 4. Blocos de Identificação (Cards em Linha)
  const cardsY = 37;
  const cardHeight = 22;
  const cardWidth = (contentWidth - 6) / 2; // 88mm cada
  const leftCardX = marginX; // 14mm
  const rightCardX = marginX + cardWidth + 6; // 108mm

  // Desenha os 2 cards lado a lado com bordas arredondadas e fundo claro
  doc.setFillColor(248, 250, 252); // #f8fafc
  doc.setDrawColor(226, 232, 240); // #e2e8f0
  doc.setLineWidth(0.3);
  doc.roundedRect(leftCardX, cardsY, cardWidth, cardHeight, 2, 2, 'FD');
  doc.roundedRect(rightCardX, cardsY, cardWidth, cardHeight, 2, 2, 'FD');

  // Conteúdo Card Esquerdo (Identificação do Atendimento)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('IDENTIFICAÇÃO DO ATENDIMENTO', leftCardX + 4, cardsY + 5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('Paciente: ', leftCardX + 4, cardsY + 11);

  const wPacLabel = doc.getTextWidth('Paciente: ');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);

  // Trunca nome do paciente se for extremamente longo para não vazar do card
  let nomeExibicao = nomePaciente;
  const maxPacWidth = cardWidth - 8 - wPacLabel;
  if (doc.getTextWidth(nomeExibicao) > maxPacWidth) {
    while (nomeExibicao.length > 3 && doc.getTextWidth(nomeExibicao + '...') > maxPacWidth) {
      nomeExibicao = nomeExibicao.slice(0, -1);
    }
    nomeExibicao += '...';
  }
  doc.text(nomeExibicao, leftCardX + 4 + wPacLabel, cardsY + 11);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text(`Período apurado: ${periodoTexto}`, leftCardX + 4, cardsY + 17);

  // Conteúdo Card Direito (Status e Valor)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('STATUS:', rightCardX + 4, cardsY + 5.5);

  // Badge do status
  const statusUpper = statusFatura.toUpperCase();
  const isFechadaOuPaga = statusUpper.includes('FECHAD') || statusUpper.includes('PAG') || statusUpper.includes('QUITAD');
  const badgeWidth = 26;
  const badgeHeight = 5.5;
  const badgeX = rightCardX + cardWidth - badgeWidth - 4;
  const badgeY = cardsY + 2.5;

  if (isFechadaOuPaga) {
    doc.setFillColor(220, 252, 231); // #dcfce7
    doc.setDrawColor(187, 247, 208); // #bbf7d0
    doc.roundedRect(badgeX, badgeY, badgeWidth, badgeHeight, 1.5, 1.5, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(22, 101, 52); // #166534
    doc.text(statusUpper, badgeX + (badgeWidth / 2), badgeY + 4, { align: 'center' });
  } else {
    doc.setFillColor(254, 243, 199); // #fef3c7
    doc.setDrawColor(253, 230, 138); // #fde68a
    doc.roundedRect(badgeX, badgeY, badgeWidth, badgeHeight, 1.5, 1.5, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(180, 83, 9); // #b45309
    doc.text(statusUpper, badgeX + (badgeWidth / 2), badgeY + 4, { align: 'center' });
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('Valor Total Previsto:', rightCardX + 4, cardsY + 14);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(26, 60, 46); // #1a3c2e
  doc.text(formatCurrency(valorTotalFinal), rightCardX + cardWidth - 4, cardsY + 17, { align: 'right' });

  // 5. Tabela de Plantões com autoTable
  const plantoesRows = plantoesValidos.map((p: any) => {
    const dataStr = formatDateBR(p.data);
    const profissionalStr = formatNomeComEspacos(p.profissional || p.nomeProfissional);
    const cargaStr = getPlantaoCargaHoraria(p);
    const servicoStr = p.tipoDia || 'Plantão Normal';
    const valorNum = getFaturaRowVal(p);
    const valorStr = formatCurrency(valorNum);

    return [dataStr, profissionalStr, cargaStr, servicoStr, valorStr];
  });

  autoTable(doc, {
    startY: cardsY + cardHeight + 4, // 63mm
    head: [['DATA', 'PROFISSIONAL', 'CARGA HORÁRIA', 'SERVIÇO', 'VALOR (R$)']],
    body: plantoesRows.length > 0 ? plantoesRows : [['-', 'Nenhum plantão registrado no período', '-', '-', 'R$ 0,00']],
    theme: 'plain',
    styles: {
      font: 'helvetica',
      fontSize: 7.5,
      cellPadding: { top: 3.2, bottom: 3.2, left: 3, right: 3 },
      textColor: [30, 41, 59],
      lineColor: [226, 232, 240],
      lineWidth: { bottom: 0.2 },
      overflow: 'linebreak',
    },
    headStyles: {
      fillColor: [26, 60, 46], // #1a3c2e (verde corporativo escuro)
      textColor: [255, 255, 255],
      font: 'helvetica',
      fontStyle: 'bold',
      fontSize: 8,
      cellPadding: { top: 3.8, bottom: 3.8, left: 3, right: 3 },
      lineWidth: 0,
    },
    columnStyles: {
      0: { cellWidth: 24, halign: 'center' },
      1: { cellWidth: 'auto', halign: 'left', fontStyle: 'bold' },
      2: { cellWidth: 28, halign: 'center' },
      3: { cellWidth: 32, halign: 'center' },
      4: { cellWidth: 32, halign: 'right', fontStyle: 'bold' },
    },
    margin: { left: marginX, right: marginX, bottom: 20 },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
  });

  // Tabela secundária para Serviços Extras / Materiais (se existirem)
  if (servicosExtras.length > 0) {
    const startExtrasY = (doc as any).lastAutoTable.finalY + 3.5;
    autoTable(doc, {
      startY: startExtrasY,
      head: [['DATA', 'SERVIÇOS ADICIONAIS / MATERIAIS', 'VALOR (R$)']],
      body: servicosExtras.map((s: any) => [
        formatDateBR(s.data),
        formatNomeComEspacos(s.descricao || 'Serviço Adicional'),
        formatCurrency(Number(s.valor) || 0),
      ]),
      theme: 'plain',
      styles: {
        font: 'helvetica',
        fontSize: 7.5,
        cellPadding: { top: 3, bottom: 3, left: 3, right: 3 },
        textColor: [30, 41, 59],
        lineColor: [226, 232, 240],
        lineWidth: { bottom: 0.2 },
      },
      headStyles: {
        fillColor: [40, 70, 58],
        textColor: [255, 255, 255],
        font: 'helvetica',
        fontStyle: 'bold',
        fontSize: 7.5,
        cellPadding: { top: 3.5, bottom: 3.5, left: 3, right: 3 },
        lineWidth: 0,
      },
      columnStyles: {
        0: { cellWidth: 24, halign: 'center' },
        1: { cellWidth: 'auto', halign: 'left' },
        2: { cellWidth: 32, halign: 'right', fontStyle: 'bold' },
      },
      margin: { left: marginX, right: marginX, bottom: 20 },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
    });
  }

  // 6. Totalizador e Rodapé
  let finalY = (doc as any).lastAutoTable.finalY;
  const boxHeight = servicosExtras.length > 0 ? 25 : 17;
  const safeBottomLimit = pageHeight - 20; // 277mm (área antes do rodapé)

  // Se o espaço restante for menor que 25mm ou não couber o totalizador, cria nova página
  if ((safeBottomLimit - finalY) < 25 || (safeBottomLimit - finalY) < (boxHeight + 4)) {
    doc.addPage();
    finalY = 20;
  }

  const boxWidth = 72;
  const boxX = rightX - boxWidth;
  const boxY = finalY + 4;

  // Renderiza o card do totalizador
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.3);
  doc.roundedRect(boxX, boxY, boxWidth, boxHeight, 2, 2, 'FD');

  if (servicosExtras.length > 0) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text('Soma Plantões:', boxX + 4, boxY + 5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text(formatCurrency(totalSomaPlantoes), boxX + boxWidth - 4, boxY + 5, { align: 'right' });

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text('Serviços Extras:', boxX + 4, boxY + 9.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text(`+ ${formatCurrency(somaExtras)}`, boxX + boxWidth - 4, boxY + 9.5, { align: 'right' });

    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.2);
    doc.line(boxX + 4, boxY + 12, boxX + boxWidth - 4, boxY + 12);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text('VALOR TOTAL DA FATURA', boxX + boxWidth - 4, boxY + 16.5, { align: 'right' });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(26, 60, 46);
    doc.text(formatCurrency(valorTotalFinal), boxX + boxWidth - 4, boxY + 22.5, { align: 'right' });
  } else {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text('VALOR TOTAL DA FATURA', boxX + boxWidth - 4, boxY + 6.5, { align: 'right' });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(26, 60, 46);
    doc.text(formatCurrency(valorTotalFinal), boxX + boxWidth - 4, boxY + 13.5, { align: 'right' });
  }

  // Rodapé limpo em todas as páginas: "Documento gerado pelo Sistema RH de Gestão • Página X de Y" (8pt, #94a3b8)
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184); // #94a3b8
    doc.text(
      `Documento gerado pelo Sistema RH de Gestão • Página ${i} de ${totalPages}`,
      pageWidth / 2,
      288,
      { align: 'center' }
    );
  }

  // 7. Salva o documento diretamente
  const safeNome = nomePaciente.replace(/[^a-zA-Z0-9à-úÀ-Ú_]/g, '_');
  const safeData = dataEmissao.replace(/\//g, '-');
  const fileName = `Fatura_${safeNome}_${safeData}.pdf`;

  doc.save(fileName);
  return doc;
};
