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
 * Converte diferentes formatos de data para DD/MM/AAAA limpo (sem formato ISO como "22T15:...").
 */
export const formatDateBR = (dateVal: any): string => {
  if (!dateVal) return new Date().toLocaleDateString('pt-BR');
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
  // Formato ISO: YYYY-MM-DD ou YYYY-MM-DDTHH:mm:ss
  const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    return `${isoMatch[3]}/${isoMatch[2]}/${isoMatch[1]}`;
  }
  // Formato DD/MM/AAAA
  const brMatch = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (brMatch) {
    return `${brMatch[1].padStart(2, '0')}/${brMatch[2].padStart(2, '0')}/${brMatch[3]}`;
  }
  // Corta antes do T se houver
  if (str.includes('T')) {
    const cleanBeforeT = str.split('T')[0];
    const match = cleanBeforeT.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      return `${match[3]}/${match[2]}/${match[1]}`;
    }
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
  return str.split('T')[0] || new Date().toLocaleDateString('pt-BR');
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
 * Formata descrição do serviço prestado na linha da tabela.
 */
export const formatServicoLinha = (p: any): string => {
  if (p.descricaoServico) return String(p.descricaoServico).trim();
  if (p.servico) return String(p.servico).trim();
  if (p.tipoServico) return String(p.tipoServico).trim();

  const carga = getPlantaoCargaHoraria(p);
  const tipoDia = p.tipoDia || '';
  if (tipoDia && tipoDia !== 'Normal') {
    return `Plantão ${carga} - ${tipoDia}`;
  }
  return `Plantão ${carga}`;
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
 * Gera e exporta o documento de Fatura do Paciente em PDF 100% nativo e vetorial usando jsPDF e autoTable,
 * seguindo rigorosamente a diagramação, seções e colunas do modelo corporativo padrão DOCX.
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
  const marginX = 14;
  const contentWidth = pageWidth - (marginX * 2); // 182mm
  const rightX = marginX + contentWidth; // 196mm

  // 2. Extração e sanitização de dados da fatura
  const rawPacienteNome = faturaData.nomePaciente || faturaData.pacienteNome || faturaData.paciente || 'Paciente';
  const nomePaciente = formatNomeComEspacos(rawPacienteNome);

  const numeroFatura = faturaData.numeroFatura || faturaData.numero || 'FAT-0000';
  const dataEmissao = formatDateBR(faturaData.dataEmissao);

  // Status da fatura formatado (Aberta / Fechada / etc)
  const rawStatus = String(faturaData.status || 'Aberta').trim().toLowerCase();
  let statusFormatado = 'Aberta';
  if (rawStatus.includes('fechad') || rawStatus.includes('pag') || rawStatus.includes('quitad')) {
    statusFormatado = 'Fechada';
  } else if (rawStatus.includes('cancel')) {
    statusFormatado = 'Cancelada';
  } else {
    statusFormatado = 'Aberta';
  }

  // Plantões válidos (exclui faltas e cancelados)
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

  // Serviços adicionais / materiais (se houver)
  const servicosExtras = Array.isArray(faturaData.servicosExtras) ? faturaData.servicosExtras : [];
  const somaExtras = servicosExtras.reduce((acc: number, curr: any) => acc + (Number(curr.valor) || 0), 0);
  const totalSomaPlantoes = plantoesValidos.reduce((acc: number, curr: any) => acc + getFaturaRowVal(curr), 0);
  const valorTotalFinal = Number(faturaData.valorTotal || faturaData.valorTotalFatura) || (totalSomaPlantoes + somaExtras);

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
  // FATURA (Negrito, 14pt, alinhado à direita)
  // Nº: FAT-XXXXXX-XXXX (Normal, 10pt, alinhado à direita)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(30, 41, 59); // #1e293b
  doc.text('FATURA', rightX, 18, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(71, 85, 105); // #475569
  doc.text(`Nº: ${numeroFatura}`, rightX, 24, { align: 'right' });

  // Linha divisória horizontal sutil abaixo do cabeçalho
  doc.setDrawColor(226, 232, 240); // #e2e8f0
  doc.setLineWidth(0.4);
  doc.line(marginX, 32, rightX, 32);

  // =========================================================================
  // 2. QUADRO: "DADOS DA FATURA E PACIENTE"
  // =========================================================================
  // Título da seção: DADOS DA FATURA E PACIENTE (Negrito, 9.5pt, caixa alta)
  const quadroTitleY = 38;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(30, 41, 59); // #1e293b
  doc.text('DADOS DA FATURA E PACIENTE', marginX, quadroTitleY);

  // Caixa de dados dividida em duas colunas
  const boxY = quadroTitleY + 3; // 41mm
  const boxHeight = 18; // 18mm
  doc.setFillColor(248, 250, 252); // #f8fafc
  doc.setDrawColor(226, 232, 240); // #e2e8f0
  doc.setLineWidth(0.3);
  doc.roundedRect(marginX, boxY, contentWidth, boxHeight, 1.5, 1.5, 'FD');

  const colLeftX = marginX + 4;
  const colRightX = marginX + (contentWidth / 2) + 2;

  // Coluna Esquerda:
  // Emissão: DD/MM/AAAA (formatar data limpa pt-BR)
  // Paciente: [Nome Completo do Paciente]
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
  doc.text('Paciente: ', colLeftX, boxY + 13.5);
  const pacLabelWidth = doc.getTextWidth('Paciente: ');
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);

  let nomeExibicao = nomePaciente;
  const maxNomeWidth = (contentWidth / 2) - 8 - pacLabelWidth;
  if (doc.getTextWidth(nomeExibicao) > maxNomeWidth) {
    while (nomeExibicao.length > 3 && doc.getTextWidth(nomeExibicao + '...') > maxNomeWidth) {
      nomeExibicao = nomeExibicao.slice(0, -1);
    }
    nomeExibicao += '...';
  }
  doc.text(nomeExibicao, colLeftX + pacLabelWidth, boxY + 13.5);

  // Coluna Direita:
  // Status: [Aberta / Fechada]
  // Valor Total: R$ X.XXX,XX (em negrito)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text('Status: ', colRightX, boxY + 6.5);
  const statusLabelWidth = doc.getTextWidth('Status: ');
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(30, 41, 59);
  doc.text(statusFormatado, colRightX + statusLabelWidth, boxY + 6.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text('Valor Total: ', colRightX, boxY + 13.5);
  const valorLabelWidth = doc.getTextWidth('Valor Total: ');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  doc.text(formatCurrency(valorTotalFinal), colRightX + valorLabelWidth, boxY + 13.5);

  // =========================================================================
  // 3. TABELA: "DETALHAMENTO DE SERVIÇOS PRESTADOS"
  // =========================================================================
  // Título da seção: DETALHAMENTO DE SERVIÇOS PRESTADOS (Negrito, 9.5pt, caixa alta)
  const tabelaTitleY = boxY + boxHeight + 6.5; // 65.5mm
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(30, 41, 59); // #1e293b
  doc.text('DETALHAMENTO DE SERVIÇOS PRESTADOS', marginX, tabelaTitleY);

  // Linhas de dados da tabela
  const tableRows: any[] = plantoesValidos.map((p: any) => {
    const dataStr = formatDateBR(p.data);
    const profissionalStr = formatNomeComEspacos(p.profissional || p.nomeProfissional);
    const servicoStr = formatServicoLinha(p);
    const valorNum = getFaturaRowVal(p);
    const valorStr = formatCurrency(valorNum);

    return [dataStr, profissionalStr, servicoStr, valorStr];
  });

  // Se houver serviços extras ou materiais registrados na fatura
  if (servicosExtras.length > 0) {
    servicosExtras.forEach((s: any) => {
      tableRows.push([
        formatDateBR(s.data),
        '-',
        formatNomeComEspacos(s.descricao || 'Serviço Adicional'),
        formatCurrency(Number(s.valor) || 0),
      ]);
    });
  }

  // Fallback caso não haja nenhum plantão
  const finalBody = tableRows.length > 0 ? tableRows : [['-', 'Nenhum plantão registrado no período', '-', 'R$ 0,00']];

  // Tabela gerada via autoTable com EXATAMENTE 4 COLUNAS:
  // Data (~25mm, centro)
  // Profissional (livre / preenche restante, esquerda)
  // Serviço (~45mm, esquerda)
  // Valor (~30mm, direita)
  // Linha Final (Total): Mesclar as primeiras 3 colunas (colSpan: 3) com o texto em negrito: TOTAL.
  // 4ª coluna: Valor Total da fatura em negrito alinhado à direita (ex: R$ 972,00).
  autoTable(doc, {
    startY: tabelaTitleY + 3.5, // ~69mm
    head: [['Data', 'Profissional', 'Serviço', 'Valor']],
    body: finalBody,
    foot: [
      [
        {
          content: 'TOTAL',
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
          content: formatCurrency(valorTotalFinal),
          styles: {
            halign: 'right',
            fontStyle: 'bold',
            fontSize: 8.5,
            textColor: [30, 41, 59],
            cellPadding: { top: 3.5, bottom: 3.5, left: 3, right: 3 },
          },
        },
      ],
    ],
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
  // Documento gerado pelo Sistema RH de Gestão • Página 1 de 1 (Cinza claro, 8pt, centralizado no fim da página)
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

  // Nome do arquivo padronizado
  const safeNome = nomePaciente.replace(/[^a-zA-Z0-9à-úÀ-Ú_]/g, '_');
  const safeData = dataEmissao.replace(/\//g, '-');
  const fileName = `Fatura_${safeNome}_${safeData}.pdf`;

  doc.save(fileName);
  return doc;
};

/**
 * Gera e exporta o Relatório de Histórico de Faturas de Pacientes em PDF 100% nativo e vetorial usando jsPDF e autoTable.
 */
export const exportHistoricoFaturasPDF = async (faturasList: any[], empresaInfo?: any, filtroTexto?: string): Promise<jsPDF> => {
  if (!faturasList || faturasList.length === 0) {
    throw new Error('Nenhuma fatura disponível para exportar.');
  }

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = 210;
  const marginX = 14;
  const contentWidth = pageWidth - (marginX * 2); // 182mm
  const rightX = marginX + contentWidth; // 196mm

  // 1. Cabeçalho Institucional
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(26, 60, 46); // #1a3c2e
  const razaoSocialEmpresa = (empresaInfo?.razaoSocial && !/VALUDARE|VALLIOARE|EIREU/i.test(empresaInfo.razaoSocial))
    ? empresaInfo.razaoSocial.replace(/\s+/g, ' ').trim()
    : 'VALLIDARE GESTÃO MÉDICA E AUDITORIA EIRELI';
  doc.text(razaoSocialEmpresa.toUpperCase(), marginX, 18);

  const cnpjEmpresa = empresaInfo?.cnpj || '27.770.797/0001-62';
  const enderecoEmpresa = empresaInfo?.endereco || 'Rua Martins Ferreira, 71 - Botafogo / Rio de Janeiro';

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105); // #475569
  doc.text(`CNPJ: ${cnpjEmpresa} • ${enderecoEmpresa}`, marginX, 23);

  // Lado Direito: Data de emissão e Total de registros
  const dataEmissaoHoje = new Date().toLocaleDateString('pt-BR');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(30, 41, 59);
  doc.text(`Data de emissão: ${dataEmissaoHoje}`, rightX, 18, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text(`Total de registros: ${faturasList.length} faturas`, rightX, 23, { align: 'right' });

  // Linha divisória sutil
  doc.setDrawColor(226, 232, 240); // #e2e8f0
  doc.setLineWidth(0.4);
  doc.line(marginX, 27, rightX, 27);

  // 2. Título da Seção e Filtro Ativo
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(26, 60, 46);
  doc.text('RELATÓRIO DE HISTÓRICO DE FATURAS DE PACIENTES', marginX, 35);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  const scopeText = filtroTexto || 'Todos os Pacientes';
  doc.text(scopeText, marginX, 40);

  // 3. Tabela Principal (autoTable)
  const tableRows = faturasList.map((f: any) => {
    const numero = f.numeroFatura || f.numero || '-';
    const paciente = formatNomeComEspacos(f.nomePaciente || f.paciente || 'Paciente');
    const emissao = formatDateBR(f.dataEmissao || f.criadoEm);
    const status = String(f.status || 'Emitida').trim();
    const valorTotalNum = Number(f.valorTotal || 0);
    const valorStr = formatCurrency(valorTotalNum);

    return [numero, paciente, emissao, status, valorStr];
  });

  const somaTotalFaturas = faturasList.reduce((acc, curr) => acc + (Number(curr.valorTotal) || 0), 0);

  autoTable(doc, {
    startY: 44,
    head: [['NÚMERO', 'PACIENTE', 'EMISSÃO', 'STATUS', 'VALOR TOTAL']],
    body: tableRows,
    foot: [
      [
        {
          content: 'SOMA TOTAL DAS FATURAS',
          colSpan: 4,
          styles: {
            halign: 'right',
            fontStyle: 'bold',
            fontSize: 9,
            textColor: [26, 60, 46],
            fillColor: [241, 245, 249],
            cellPadding: { top: 4, bottom: 4, left: 3, right: 4 },
          },
        },
        {
          content: formatCurrency(somaTotalFaturas),
          styles: {
            halign: 'right',
            fontStyle: 'bold',
            fontSize: 9.5,
            textColor: [26, 60, 46],
            fillColor: [241, 245, 249],
            cellPadding: { top: 4, bottom: 4, left: 3, right: 3 },
          },
        },
      ],
    ],
    theme: 'plain',
    styles: {
      font: 'helvetica',
      fontSize: 8,
      cellPadding: { top: 3, bottom: 3, left: 3, right: 3 },
      textColor: [30, 41, 59],
      lineColor: [226, 232, 240],
      lineWidth: { bottom: 0.2 },
      overflow: 'linebreak',
    },
    headStyles: {
      fillColor: [26, 60, 46], // #1a3c2e
      textColor: [255, 255, 255],
      font: 'helvetica',
      fontStyle: 'bold',
      fontSize: 8.5,
      cellPadding: { top: 3.5, bottom: 3.5, left: 3, right: 3 },
    },
    columnStyles: {
      0: { cellWidth: 38, halign: 'left', fontStyle: 'bold' },
      1: { cellWidth: 64, halign: 'left' },
      2: { cellWidth: 25, halign: 'center' },
      3: { cellWidth: 25, halign: 'center', fontStyle: 'bold' },
      4: { cellWidth: 30, halign: 'right', fontStyle: 'bold' },
    },
    margin: { left: marginX, right: marginX, bottom: 18 },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
  });

  // 4. Rodapé em todas as páginas
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(156, 163, 175); // #9ca3af
    doc.text(
      `Relatório Gerado pelo Sistema RH de Gestão • Página ${i} de ${totalPages}`,
      pageWidth / 2,
      288,
      { align: 'center' }
    );
  }

  const fileName = `Relatorio_Historico_Faturas_${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(fileName);
  return doc;
};

