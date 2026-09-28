import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  Sparkles, 
  ShieldCheck, 
  Lock, 
  Bot, 
  Send, 
  AlertCircle, 
  RefreshCw, 
  Copy, 
  Check, 
  Printer, 
  Trash2, 
  TrendingUp, 
  Users, 
  Calendar, 
  AlertTriangle,
  HelpCircle,
  MessageSquare,
  ChevronDown
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useFirebase } from '../context/FirebaseContext';
import { consultarAssistenteOperacional } from '../services/geminiOperacoesService';
import { db } from '../lib/firebase';
import { collection, query, limit, getDocs, getDoc, doc } from 'firebase/firestore';
import { Profissional, Paciente, Agendamento } from '../types';

const NOMES_DIAS_SEMANA_COMPLETOS = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];

/**
 * Normaliza e extrai data ISO YYYY-MM-DD
 */
function parseDataIso(dateVal: any): string | null {
  if (!dateVal) return null;
  if (typeof dateVal === 'string') {
    const s = dateVal.trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.substring(0, 10);
    const brMatch = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (brMatch) {
      return `${brMatch[3]}-${brMatch[2].padStart(2, '0')}-${brMatch[1].padStart(2, '0')}`;
    }
    const d = new Date(s);
    if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
  } else if (dateVal instanceof Date) {
    return dateVal.toISOString().split('T')[0];
  } else if (dateVal?.toDate && typeof dateVal.toDate === 'function') {
    return dateVal.toDate().toISOString().split('T')[0];
  } else if (dateVal?.seconds) {
    return new Date(dateVal.seconds * 1000).toISOString().split('T')[0];
  }
  return null;
}

/**
 * Verifica se a data da escala pertence ao intervalo (ex: Setembro/2026 = 01/09/2026 até 30/09/2026)
 */
function pertenceAoIntervalo(dateVal: any, dataInicioIso: string = '2026-09-01', dataFimIso: string = '2026-09-30'): boolean {
  const iso = parseDataIso(dateVal);
  if (!iso) return false;
  return iso >= dataInicioIso && iso <= dataFimIso;
}

/**
 * Classificação estrita de escalas:
 * - Concluída/Alocada: escala com ID ou nome de profissional preenchido
 */
function isEscalaAlocada(e: any): boolean {
  if (!e) return false;
  const profId = String(e.idProfissional || e.profissionalId || e.cuidadorId || e.funcionarioId || '').trim();
  const profNome = String(e.nomeProfissional || e.profissionalNome || e.nomeCuidador || e.nomeFuncionario || e.profissional || '').trim();
  const statusStr = String(e.status || '').toLowerCase().trim();

  // Escala sem profissional ou explicitamente em aberto
  if (statusStr === 'aberto' || statusStr === 'aberta' || statusStr === 'pendente') {
    if (!profId && !profNome) return false;
  }
  if (
    profId.toLowerCase() === 'não_alocado' || 
    profId.toLowerCase() === 'vago' || 
    profId.toLowerCase() === 'sem_profissional' ||
    profId.toLowerCase() === 'pendente'
  ) {
    return false;
  }
  if (
    profNome.toLowerCase().includes('não_alocado') ||
    profNome.toLowerCase().includes('não alocado') || 
    profNome.toLowerCase().includes('sem profissional') || 
    profNome.toLowerCase().includes('vago') || 
    profNome.toLowerCase().includes('vaga') ||
    profNome.toLowerCase().includes('pendente')
  ) {
    return false;
  }
  return Boolean(profId || profNome);
}

/**
 * - Vaga/Em Aberto: escala sem profissional atribuído ou com status "aberto"/"pendente"
 */
function isEscalaVaga(e: any): boolean {
  return !isEscalaAlocada(e);
}

/**
 * - Curinga: escalas com flag curinga: true
 */
function isEscalaCuringa(e: any): boolean {
  if (!e) return false;
  return Boolean(
    e.curinga === true ||
    e.isCuringa === true ||
    (e.tipoEscala && String(e.tipoEscala).toLowerCase().includes('curinga')) ||
    (e.observacao && String(e.observacao).toUpperCase().includes('CURINGA')) ||
    (e.motivoFalta && String(e.motivoFalta).toUpperCase().includes('CURINGA')) ||
    (e.motivo && String(e.motivo).toUpperCase().includes('CURINGA'))
  );
}

/**
 * Higieniza tabelas Markdown que possam ter vindo concatenadas em linha única (ex: | Métrica | Valor || :--- |)
 */
function normalizarMarkdownTabelas(texto: string): string {
  if (!texto) return '';

  // Substitui sequências grudadas '||' por '|\n|' para que o parser GFM divida as linhas da tabela
  let formatado = texto.replace(/\|\|+/g, '|\n|');

  // Quebra caso haja colunas seguidas de cabeçalho grudado '| ... | | :--- |'
  formatado = formatado.replace(/\|\s+(\|\s*:?-+:?)/g, '|\n$1');

  // Garante que o bloco de tabela seja isolado por linhas em branco
  formatado = formatado.replace(/([^\n])\n(\|.+\|)\n([^\n])/g, '$1\n\n$2\n\n$3');

  return formatado;
}

function extrairDataIsoEDiaSemana(dateVal: any): { data: string; diaSemana: string } {
  if (!dateVal) return { data: 'N/D', diaSemana: 'N/D' };
  let str = '';
  if (typeof dateVal === 'string') {
    str = dateVal.trim();
    if (str.includes('/')) {
      const parts = str.split('/');
      if (parts.length === 3) {
        if (parts[0].length === 4) {
          str = `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
        } else {
          str = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
        }
      }
    } else if (str.includes('T')) {
      str = str.split('T')[0];
    }
  } else if (dateVal instanceof Date) {
    str = dateVal.toISOString().split('T')[0];
  } else if (dateVal?.toDate && typeof dateVal.toDate === 'function') {
    str = dateVal.toDate().toISOString().split('T')[0];
  } else if (dateVal?.seconds) {
    str = new Date(dateVal.seconds * 1000).toISOString().split('T')[0];
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const [ano, mes, dia] = str.split('-').map(Number);
    const dObj = new Date(ano, mes - 1, dia);
    const diaSemana = NOMES_DIAS_SEMANA_COMPLETOS[dObj.getDay()] || 'N/D';
    return { data: str, diaSemana };
  }

  return { data: str || 'N/D', diaSemana: 'N/D' };
}

/**
 * Camada de Agregação Determinística:
 * Processa matematicamente todas as métricas operacionais antes do envio à IA para eliminar alucinações.
 */
function calcularAgregacaoOperacional(
  escalas: any[],
  pacientes: any[],
  profissionais: any[],
  faturas: any[],
  debitos: any[]
) {
  const diasSemanaOrdem = ['Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado', 'Domingo'];
  
  // 1. Resumo Geral
  const totalPacientes = pacientes.filter((p: any) => (p.status || '').toLowerCase() === 'ativo').length || pacientes.length;
  const totalProfissionais = profissionais.filter((p: any) => (p.status || '').toLowerCase() !== 'inativo').length || profissionais.length;
  const totalEscalas = escalas.length;

  // 2. Escalas por Dia da Semana
  const escalasPorDiaSemana: Record<string, { total: number; completas: number; vagas: number; curingas: number }> = {};
  diasSemanaOrdem.forEach(dia => {
    escalasPorDiaSemana[dia] = { total: 0, completas: 0, vagas: 0, curingas: 0 };
  });

  const sabadoPacientesMap = new Map<string, Set<string>>();
  const domingoPacientesMap = new Map<string, Set<string>>();
  let sabadoCompletas = 0;
  let sabadoVagas = 0;
  let domingoCompletas = 0;
  let domingoVagas = 0;

  const vagasPorPaciente: Record<string, number> = {};
  let totalCuringas = 0;
  const curingasPorDia: Record<string, number> = {};
  diasSemanaOrdem.forEach(dia => { curingasPorDia[dia] = 0; });

  escalas.forEach(e => {
    const diaRaw = String(e.diaSemana || '').trim();
    let dia = 'N/D';
    if (diaRaw.includes('Seg')) dia = 'Segunda-feira';
    else if (diaRaw.includes('Ter')) dia = 'Terça-feira';
    else if (diaRaw.includes('Qua')) dia = 'Quarta-feira';
    else if (diaRaw.includes('Qui')) dia = 'Quinta-feira';
    else if (diaRaw.includes('Sex')) dia = 'Sexta-feira';
    else if (diaRaw.includes('Sáb') || diaRaw.includes('Sab')) dia = 'Sábado';
    else if (diaRaw.includes('Dom')) dia = 'Domingo';

    const isCompleta = e.statusAlocacao === 'completa';
    const isCuringa = Boolean(e.curinga);

    if (escalasPorDiaSemana[dia]) {
      escalasPorDiaSemana[dia].total++;
      if (isCompleta) escalasPorDiaSemana[dia].completas++;
      else escalasPorDiaSemana[dia].vagas++;
      if (isCuringa) escalasPorDiaSemana[dia].curingas++;
    }

    if (isCuringa) {
      totalCuringas++;
      if (curingasPorDia[dia] !== undefined) curingasPorDia[dia]++;
    }

    if (!isCompleta) {
      const pacCod = e.pacienteCodigo || 'PAC_ND';
      vagasPorPaciente[pacCod] = (vagasPorPaciente[pacCod] || 0) + 1;
    }

    // Fim de Semana
    if (dia === 'Sábado') {
      if (isCompleta) sabadoCompletas++;
      else sabadoVagas++;
      const pacCod = e.pacienteCodigo || 'PAC_ND';
      const turno = e.turno || '12h Diurno';
      if (!sabadoPacientesMap.has(pacCod)) sabadoPacientesMap.set(pacCod, new Set());
      sabadoPacientesMap.get(pacCod)!.add(turno);
    } else if (dia === 'Domingo') {
      if (isCompleta) domingoCompletas++;
      else domingoVagas++;
      const pacCod = e.pacienteCodigo || 'PAC_ND';
      const turno = e.turno || '12h Diurno';
      if (!domingoPacientesMap.has(pacCod)) domingoPacientesMap.set(pacCod, new Set());
      domingoPacientesMap.get(pacCod)!.add(turno);
    }
  });

  const sabadoPacientesAtendidos: string[] = [];
  sabadoPacientesMap.forEach((turnos, pac) => {
    turnos.forEach(t => sabadoPacientesAtendidos.push(`${pac} (${t})`));
  });
  sabadoPacientesAtendidos.sort();

  const domingoPacientesAtendidos: string[] = [];
  domingoPacientesMap.forEach((turnos, pac) => {
    turnos.forEach(t => domingoPacientesAtendidos.push(`${pac} (${t})`));
  });
  domingoPacientesAtendidos.sort();

  // 3. Fim de Semana Estruturado
  const escalasFimDeSemana = {
    sabado: {
      total: (escalasPorDiaSemana['Sábado']?.total || 0),
      completas: sabadoCompletas,
      vagas: sabadoVagas,
      pacientesAtendidos: sabadoPacientesAtendidos
    },
    domingo: {
      total: (escalasPorDiaSemana['Domingo']?.total || 0),
      completas: domingoCompletas,
      vagas: domingoVagas,
      pacientesAtendidos: domingoPacientesAtendidos
    }
  };

  // 4. Gargalos de Escala
  const totalCompletas = escalas.filter(e => e.statusAlocacao === 'completa').length;
  const totalVagas = escalas.filter(e => e.statusAlocacao !== 'completa').length;
  const taxaOcupacao = totalEscalas > 0 ? Number(((totalCompletas / totalEscalas) * 100).toFixed(1)) : 100;
  const pacientesAfetados = Object.entries(vagasPorPaciente)
    .sort((a, b) => b[1] - a[1])
    .map(([pac, qtd]) => `${pac} (${qtd} ${qtd > 1 ? 'vagas em aberto' : 'vaga em aberto'})`);

  const gargalosEscala = {
    escalasVagasTotal: totalVagas,
    escalasCompletasTotal: totalCompletas,
    taxaOcupacaoPercentual: taxaOcupacao,
    pacientesAfetados
  };

  // 5. Estatísticas de Curingas
  const distribuicaoPercentual: Record<string, string> = {};
  diasSemanaOrdem.forEach(dia => {
    const qtd = curingasPorDia[dia] || 0;
    const perc = totalCuringas > 0 ? ((qtd / totalCuringas) * 100).toFixed(1) + '%' : '0%';
    distribuicaoPercentual[dia] = perc;
  });

  const estatisticasCuringas = {
    total: totalCuringas,
    percentualDoTotal: totalEscalas > 0 ? Number(((totalCuringas / totalEscalas) * 100).toFixed(1)) : 0,
    distribuicaoDias: curingasPorDia,
    distribuicaoPercentual
  };

  // 6. Financeiro Consolidado
  const totalDebitos = (debitos || []).reduce((acc: number, d: any) => acc + (Number(d.valor) || 0), 0);
  const totalCreditos = (faturas || []).reduce((acc: number, f: any) => acc + (Number(f.valorTotal) || 0), 0);
  const financeiroConsolidado = {
    totalDebitos: Math.round(totalDebitos * 100) / 100,
    totalCreditos: Math.round(totalCreditos * 100) / 100,
    saldoOperacional: Math.round((totalCreditos - totalDebitos) * 100) / 100
  };

  return {
    resumoGeral: {
      totalPacientes,
      totalProfissionais,
      totalEscalas
    },
    escalasPorDiaSemana,
    escalasFimDeSemana,
    gargalosEscala,
    estatisticasCuringas,
    financeiroConsolidado
  };
}

interface PeriodoDetectado {
  descricao: string;
  meses: Array<{ ano: number; mes: number }>;
}

const MESES_NOMES = [
  '', 'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

const MESES_MAP: Record<string, number> = {
  janeiro: 1, jan: 1,
  fevereiro: 2, fev: 2,
  marco: 3, março: 3, mar: 3,
  abril: 4, abr: 4,
  maio: 5, mai: 5,
  junho: 6, jun: 6,
  julho: 7, jul: 7,
  agosto: 8, ago: 8,
  setembro: 9, set: 9,
  outubro: 10, out: 10,
  novembro: 11, nov: 11,
  dezembro: 12, dez: 12
};

function extrairAnoMes(dateVal: any, mesRefVal?: string): { ano: number; mes: number } | null {
  if (mesRefVal && typeof mesRefVal === 'string') {
    const s = mesRefVal.trim().toLowerCase();
    const matchIso = s.match(/(\d{4})-(\d{1,2})/);
    if (matchIso) return { ano: parseInt(matchIso[1], 10), mes: parseInt(matchIso[2], 10) };
    const matchBr = s.match(/(\d{1,2})\/(\d{4})/);
    if (matchBr) return { ano: parseInt(matchBr[2], 10), mes: parseInt(matchBr[1], 10) };
    for (const [nome, num] of Object.entries(MESES_MAP)) {
      if (s.includes(nome)) {
        const anoMatch = s.match(/20\d{2}/);
        return { ano: anoMatch ? parseInt(anoMatch[0], 10) : 2026, mes: num };
      }
    }
  }
  if (!dateVal) return null;
  if (dateVal instanceof Date) {
    return { ano: dateVal.getFullYear(), mes: dateVal.getMonth() + 1 };
  }
  if (dateVal?.seconds) {
    const d = new Date(dateVal.seconds * 1000);
    return { ano: d.getFullYear(), mes: d.getMonth() + 1 };
  }
  if (typeof dateVal === 'string') {
    const s = dateVal.trim();
    const matchIso = s.match(/^(\d{4})-(\d{2})/);
    if (matchIso) return { ano: parseInt(matchIso[1], 10), mes: parseInt(matchIso[2], 10) };
    const matchBr = s.match(/(\d{2})\/(\d{2})\/(\d{4})/);
    if (matchBr) return { ano: parseInt(matchBr[3], 10), mes: parseInt(matchBr[2], 10) };
    const matchBrMesAno = s.match(/^(\d{2})\/(\d{4})/);
    if (matchBrMesAno) return { ano: parseInt(matchBrMesAno[2], 10), mes: parseInt(matchBrMesAno[1], 10) };
    const d = new Date(s);
    if (!isNaN(d.getTime())) return { ano: d.getFullYear(), mes: d.getMonth() + 1 };
  }
  return null;
}

function obterUltimoMesComFaturas(faturas: any[], agendamentos: any[]): { ano: number; mes: number } {
  let ultAno = 2026;
  let ultMes = 8;
  let achou = false;

  (faturas || []).forEach(f => {
    const fatAny = f as any;
    const info = extrairAnoMes(f.dataEmissao || f.periodoApurado?.fim || fatAny.createdAt, f.mesReferencia);
    if (info) {
      if (!achou || info.ano > ultAno || (info.ano === ultAno && info.mes > ultMes)) {
        ultAno = info.ano;
        ultMes = info.mes;
        achou = true;
      }
    }
  });

  if (!achou) {
    (agendamentos || []).forEach(a => {
      const aAny = a as any;
      const info = extrairAnoMes(a.data || aAny.dataInicio);
      if (info) {
        if (!achou || info.ano > ultAno || (info.ano === ultAno && info.mes > ultMes)) {
          ultAno = info.ano;
          ultMes = info.mes;
          achou = true;
        }
      }
    });
  }

  return { ano: ultAno, mes: ultMes };
}

function detectarPeriodoConsulta(pergunta: string, faturas: any[], agendamentos: any[]): PeriodoDetectado {
  const pLower = (pergunta || '').toLowerCase();
  const ult = obterUltimoMesComFaturas(faturas, agendamentos);

  // 1. Detectar ano específico (ex: 2025, 2026, 2024)
  const anoMatch = pLower.match(/\b(20\d{2})\b/);
  const anoPadrao = anoMatch ? parseInt(anoMatch[1], 10) : ult.ano;

  // 2. Verificar se pede "mês atual e no mês anterior" ou variações
  if (
    pLower.includes('mês atual e no mês anterior') ||
    pLower.includes('mes atual e no mes anterior') ||
    pLower.includes('mês atual e mês anterior') ||
    pLower.includes('mes atual e mes anterior') ||
    pLower.includes('mês atual e anterior') ||
    pLower.includes('mes atual e anterior')
  ) {
    const mesAtual = ult.mes;
    const anoAtual = ult.ano;
    const mesAnt = mesAtual === 1 ? 12 : mesAtual - 1;
    const anoAnt = mesAtual === 1 ? anoAtual - 1 : anoAtual;
    return {
      descricao: `${MESES_NOMES[mesAnt]}/${anoAnt} e ${MESES_NOMES[mesAtual]}/${anoAtual}`,
      meses: [
        { ano: anoAnt, mes: mesAnt },
        { ano: anoAtual, mes: mesAtual }
      ]
    };
  }

  // 3. Verificar menções a meses individuais em português
  const mesesEncontrados: number[] = [];
  for (const [nomeMes, numMes] of Object.entries(MESES_MAP)) {
    const regex = new RegExp(`\\b${nomeMes}\\b`, 'i');
    if (regex.test(pLower) && !mesesEncontrados.includes(numMes)) {
      mesesEncontrados.push(numMes);
    }
  }

  if (mesesEncontrados.length > 0) {
    const meses = mesesEncontrados.map(m => ({ ano: anoPadrao, mes: m }));
    const nomes = meses.map(m => `${MESES_NOMES[m.mes]}/${m.ano}`).join(' e ');
    return {
      descricao: nomes,
      meses
    };
  }

  // 4. Se mencionou apenas o ano (ex: "ano de 2026", "em 2026")
  if (anoMatch) {
    const meses = Array.from({ length: 12 }, (_, i) => ({ ano: anoPadrao, mes: i + 1 }));
    return {
      descricao: `Ano de ${anoPadrao}`,
      meses
    };
  }

  // 5. Se mencionou apenas "mês anterior"
  if (pLower.includes('mês anterior') || pLower.includes('mes anterior')) {
    const mesAnt = ult.mes === 1 ? 12 : ult.mes - 1;
    const anoAnt = ult.mes === 1 ? ult.ano - 1 : ult.ano;
    return {
      descricao: `${MESES_NOMES[mesAnt]} de ${anoAnt}`,
      meses: [{ ano: anoAnt, mes: mesAnt }]
    };
  }

  // 6. Se nenhum for especificado, utiliza o último mês com faturas consolidadas
  return {
    descricao: `${MESES_NOMES[ult.mes]} de ${ult.ano} (último mês consolidado)`,
    meses: [{ ano: ult.ano, mes: ult.mes }]
  };
}

function dataPertenceAoPeriodo(
  dateVal: any,
  mesRefVal: string | undefined,
  mesesAlvo: Array<{ ano: number; mes: number }>
): boolean {
  const info = extrairAnoMes(dateVal, mesRefVal);
  if (!info) return false;
  return mesesAlvo.some(m => m.ano === info.ano && m.mes === info.mes);
}

interface MensagemInterativa {
  id: string;
  tipo: 'pergunta' | 'resposta';
  texto: string;
  timestamp: string;
}

export const AnaliseInteligenteOperacoes: React.FC = () => {
  const { 
    user, 
    userRole, 
    pacientes, 
    profissionais, 
    agendamentos, 
    faturasPacientes, 
    folhasPagamento, 
    debitosProfissionais 
  } = useFirebase();

  // Controle Estrito de Acesso para Administradores
  const isAdmin = useMemo(() => {
    const role = (userRole || '').toLowerCase();
    const email = (user?.email || '').toLowerCase();
    return (
      role === 'administrador' || 
      role === 'admin' || 
      email === 'renatobz@gmail.com' || 
      email === 'rhgestaodomiciliar@gmail.com'
    );
  }, [userRole, user?.email]);

  const [perguntaInput, setPerguntaInput] = useState('');
  const [mensagens, setMensagens] = useState<MensagemInterativa[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState<string>('');
  const [erro, setErro] = useState<string | null>(null);
  const [copiadoId, setCopiadoId] = useState<string | null>(null);
  const [dropdownAberto, setDropdownAberto] = useState(false);

  // Carregamento de TODOS os pacientes e TODAS as escalas ativas vinculadas à empresa (sem restrição ou filtro de seleção única)
  const [todosPacientes, setTodosPacientes] = useState<Paciente[]>([]);
  const [todasEscalas, setTodasEscalas] = useState<Agendamento[]>([]);
  const [carregandoBase, setCarregandoBase] = useState<boolean>(true);

  useEffect(() => {
    let ativo = true;

    async function sincronizarBaseCompleta() {
      try {
        setCarregandoBase(true);
        // 1. Carregar TODOS os pacientes vinculados à empresa sem limites artificiais
        let listaPac: Paciente[] = [];
        try {
          const snapPacs = await getDocs(collection(db, 'pacientes'));
          snapPacs.forEach(d => {
            listaPac.push({ ...d.data(), id: d.id } as Paciente);
          });
        } catch (e) {
          console.warn('[AnaliseInteligente] Aviso ao buscar pacientes do Firestore:', e);
        }

        if (listaPac.length === 0 && pacientes.length > 0) {
          listaPac = [...pacientes];
        }

        // 2. Carregar TODAS as escalas da empresa
        let listaAgs: Agendamento[] = [];
        try {
          const snapAgs = await getDocs(collection(db, 'agendamentos'));
          snapAgs.forEach(d => {
            listaAgs.push({ ...d.data(), id: d.id } as Agendamento);
          });
        } catch (e) {
          console.warn('[AnaliseInteligente] Aviso ao buscar agendamentos do Firestore:', e);
        }

        if (listaAgs.length === 0 && agendamentos.length > 0) {
          listaAgs = [...agendamentos];
        }

        if (ativo) {
          if (listaPac.length > 0) setTodosPacientes(listaPac);
          if (listaAgs.length > 0) setTodasEscalas(listaAgs);
        }
      } catch (err) {
        console.error('[AnaliseInteligente] Erro ao sincronizar base completa:', err);
      } finally {
        if (ativo) setCarregandoBase(false);
      }
    }

    sincronizarBaseCompleta();
    return () => { ativo = false; };
  }, [pacientes, agendamentos]);

  const listaPacientesEfetiva = useMemo(() => {
    // Garante que toda a base de pacientes ativos seja considerada, sem limites artificiais
    if (todosPacientes.length > 0) return todosPacientes;
    return pacientes || [];
  }, [todosPacientes, pacientes]);

  const listaEscalasEfetiva = useMemo(() => {
    if (todasEscalas.length > 0) return todasEscalas;
    return agendamentos || [];
  }, [todasEscalas, agendamentos]);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const mensagensEndRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fechar dropdown ao clicar fora ou pressionar ESC
  useEffect(() => {
    function handleClickFora(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownAberto(false);
      }
    }
    function handleKeyDownEsc(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setDropdownAberto(false);
      }
    }
    if (dropdownAberto) {
      document.addEventListener('mousedown', handleClickFora);
      window.addEventListener('keydown', handleKeyDownEsc);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickFora);
      window.removeEventListener('keydown', handleKeyDownEsc);
    };
  }, [dropdownAberto]);

  // Cálculos prévios das métricas operacionais para transparência e contexto
  const metricasSumarizadas = useMemo(() => {
    // 1. Pacientes ativos vinculados à empresa
    const pacsAtivosList = listaPacientesEfetiva.filter(p => {
      const st = String(p.status || 'Ativo').toLowerCase().trim();
      return st !== 'inativo' && st !== 'desativado' && st !== 'cancelado';
    });
    const totalPac = listaPacientesEfetiva.length;
    const pacAtivos = pacsAtivosList.length > 0 ? pacsAtivosList.length : totalPac;

    // 2. Profissionais
    const totalProf = profissionais.length;
    const profAtivos = profissionais.filter(p => (p.status || '').toLowerCase() !== 'inativo').length;

    // 3. Escalas do Mês Corrente (Setembro/2026: 01/09/2026 até 30/09/2026)
    const escalasSetembro = listaEscalasEfetiva.filter(e => {
      const dataVal = e.data || (e as any).dataInicio || (e as any).dataPrevista;
      return pertenceAoIntervalo(dataVal, '2026-09-01', '2026-09-30');
    });

    const escalasApuradasMes = escalasSetembro.length > 0 ? escalasSetembro : listaEscalasEfetiva;
    const totalEscalasMes = escalasApuradasMes.length;
    const concluidas = escalasApuradasMes.filter(isEscalaAlocada).length;
    const vagas = escalasApuradasMes.filter(isEscalaVaga).length;
    const curingas = escalasApuradasMes.filter(isEscalaCuringa).length;

    const faturamentoConsolidado = faturasPacientes.reduce((acc, f) => acc + (Number(f.valorTotal || 0)), 0);
    const custoFolhaConsolidado = folhasPagamento.reduce((acc, folha) => acc + (Number(folha.valorLiquidoReceber || folha.valorTotalPlantoes || 0)), 0);
    const totalDebitos = debitosProfissionais.reduce((acc, d) => acc + (Number(d.valor || 0)), 0);

    return {
      totalPac,
      pacAtivos,
      totalProf,
      profAtivos,
      totalEsc: listaEscalasEfetiva.length,
      totalEscalasMes,
      concluidas,
      vagas,
      curingas,
      escalasSemAlocacao: vagas,
      faturamentoConsolidado,
      custoFolhaConsolidado,
      totalDebitos
    };
  }, [listaPacientesEfetiva, listaEscalasEfetiva, profissionais, faturasPacientes, folhasPagamento, debitosProfissionais]);

  // Rolar para a última mensagem ao atualizar histórico
  useEffect(() => {
    if (mensagens.length > 0) {
      mensagensEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [mensagens, loading]);

  // Se não for administrador, não renderiza a seção
  if (!isAdmin) {
    return null;
  }

  // Envio de pergunta
  const handleConsultar = async (perguntaPersonalizada?: string) => {
    const textoParaEnviar = (perguntaPersonalizada ?? perguntaInput).trim();
    if (!textoParaEnviar || loading) return;

    const idPergunta = `perg-${Date.now()}`;
    const novaMensagemPergunta: MensagemInterativa = {
      id: idPergunta,
      tipo: 'pergunta',
      texto: textoParaEnviar,
      timestamp: new Date().toISOString()
    };

    setMensagens(prev => [...prev, novaMensagemPergunta]);
    setPerguntaInput('');
    setLoading(true);
    setErro(null);
    setLoadingStep('Higienizando dados e aplicando anonimização LGPD...');

    setTimeout(() => {
      setLoadingStep('Processando consulta com os dados operacionais...');
    }, 700);

    try {
      // 1. Garantir lista completa de profissionais cadastrados em memória
      let listaProfissionais: Profissional[] = [...(profissionais || [])];
      try {
        if (listaProfissionais.length === 0) {
          const profsSnap = await getDocs(query(collection(db, 'profissionais'), limit(1000)));
          const docsProfs: Profissional[] = [];
          profsSnap.forEach(d => docsProfs.push({ ...d.data(), id: d.id } as Profissional));
          if (docsProfs.length > 0) {
            listaProfissionais = docsProfs;
          }
        }
      } catch (err) {
        console.warn('[AnaliseInteligente] Busca de profissionais em fallback:', err);
      }

      // Buscar por ID eventuais profissionais citados nas escalas que não constem na lista em memória
      const profIdsConhecidos = new Set(listaProfissionais.map(p => p.id));
      const profIdsFaltantes: string[] = [];
      (listaEscalasEfetiva || []).forEach(e => {
        const eAny = e as any;
        const pId = e.idProfissional || eAny.profissionalId || eAny.cuidadorId || eAny.funcionarioId || eAny.idCuidador || eAny.idFuncionario;
        if (pId && !profIdsConhecidos.has(pId) && !profIdsFaltantes.includes(pId)) {
          profIdsFaltantes.push(pId);
        }
      });

      if (profIdsFaltantes.length > 0) {
        try {
          for (const pId of profIdsFaltantes) {
            const docSnap = await getDoc(doc(db, 'profissionais', pId));
            if (docSnap.exists()) {
              const profDoc = { ...docSnap.data(), id: docSnap.id } as Profissional;
              listaProfissionais.push(profDoc);
              profIdsConhecidos.add(pId);
            }
          }
        } catch (err) {
          console.warn('[AnaliseInteligente] Busca de profissionais faltantes por ID:', err);
        }
      }

      // Carregar TODOS os pacientes ativos vinculados à empresa (sem restrição ou filtro de seleção única)
      let listaPacientes: Paciente[] = [...listaPacientesEfetiva];
      try {
        if (listaPacientes.length <= 1) {
          const pacsSnap = await getDocs(collection(db, 'pacientes'));
          const docsPacs: Paciente[] = [];
          pacsSnap.forEach(d => docsPacs.push({ ...d.data(), id: d.id } as Paciente));
          if (docsPacs.length > 0) {
            listaPacientes = docsPacs;
          }
        }
      } catch (err) {
        console.warn('[AnaliseInteligente] Busca de pacientes em fallback:', err);
      }

      // Mapeamento rápido de profissionais e pacientes cadastrados (ID, código, CPF -> nomeReal)
      const mapaProfissionaisCadastrados = new Map<string, string>();
      listaProfissionais.forEach(p => {
        const pAny = p as any;
        const nomeReal = String(p.nome || pAny.nomeCompleto || pAny.nomeProfissional || pAny.name || '').trim();
        if (!nomeReal) return;
        if (p.id) {
          mapaProfissionaisCadastrados.set(String(p.id).trim(), nomeReal);
          mapaProfissionaisCadastrados.set(String(p.id).trim().toLowerCase(), nomeReal);
        }
        if (pAny.uid) {
          mapaProfissionaisCadastrados.set(String(pAny.uid).trim(), nomeReal);
          mapaProfissionaisCadastrados.set(String(pAny.uid).trim().toLowerCase(), nomeReal);
        }
        if (pAny.cuidadorId) {
          mapaProfissionaisCadastrados.set(String(pAny.cuidadorId).trim(), nomeReal);
        }
        if (pAny.funcionarioId) {
          mapaProfissionaisCadastrados.set(String(pAny.funcionarioId).trim(), nomeReal);
        }
        if (pAny.codigo) {
          mapaProfissionaisCadastrados.set(String(pAny.codigo).trim().toLowerCase(), nomeReal);
        }
        if (p.cpf) {
          mapaProfissionaisCadastrados.set(p.cpf.replace(/\D/g, ''), nomeReal);
        }
      });

      const mapaPacientesCadastrados = new Map<string, string>();
      listaPacientes.forEach(p => {
        const pAny = p as any;
        const nomeReal = String(p.nome || pAny.nomeCompleto || pAny.name || '').trim();
        if (!nomeReal) return;
        if (p.id) {
          mapaPacientesCadastrados.set(String(p.id).trim(), nomeReal);
          mapaPacientesCadastrados.set(String(p.id).trim().toLowerCase(), nomeReal);
        }
        if (pAny.uid) {
          mapaPacientesCadastrados.set(String(pAny.uid).trim(), nomeReal);
          mapaPacientesCadastrados.set(String(pAny.uid).trim().toLowerCase(), nomeReal);
        }
        if (pAny.codigo) {
          mapaPacientesCadastrados.set(String(pAny.codigo).trim().toLowerCase(), nomeReal);
        }
        if (p.cpf) {
          mapaPacientesCadastrados.set(p.cpf.replace(/\D/g, ''), nomeReal);
        }
      });

      // Tabela de-para em memória para reversão no cliente (Privacy by Design / LGPD)
      const mapaDePara: Record<string, string> = {};

      const registrarVariacoesProfissional = (indice: number, nomeReal: string, idOriginal?: string) => {
        if (!nomeReal) return;
        const nomeLimpo = nomeReal.trim();
        const pad2 = String(indice).padStart(2, '0');
        const numStr = String(indice);

        // Variações com P-XX (ex: [P-01], [P-1], P-01, P-1)
        mapaDePara[`[P-${pad2}]`] = nomeLimpo;
        mapaDePara[`[P-${numStr}]`] = nomeLimpo;
        mapaDePara[`P-${pad2}`] = nomeLimpo;
        mapaDePara[`P-${numStr}`] = nomeLimpo;

        // Variações com PROF_XX e PROF-XX
        mapaDePara[`[PROF_${pad2}]`] = nomeLimpo;
        mapaDePara[`[PROF-${pad2}]`] = nomeLimpo;
        mapaDePara[`PROF_${pad2}`] = nomeLimpo;
        mapaDePara[`PROF-${pad2}`] = nomeLimpo;
        mapaDePara[`[PROF_${numStr}]`] = nomeLimpo;
        mapaDePara[`[PROF-${numStr}]`] = nomeLimpo;
        mapaDePara[`PROF_${numStr}`] = nomeLimpo;
        mapaDePara[`PROF-${numStr}`] = nomeLimpo;

        // Variações com prefixo literal "Profissional"
        mapaDePara[`Profissional [P-${pad2}]`] = nomeLimpo;
        mapaDePara[`Profissional [P-${numStr}]`] = nomeLimpo;
        mapaDePara[`Profissional P-${pad2}`] = nomeLimpo;
        mapaDePara[`Profissional P-${numStr}`] = nomeLimpo;
        mapaDePara[`Profissional [PROF_${pad2}]`] = nomeLimpo;
        mapaDePara[`Profissional PROF_${pad2}`] = nomeLimpo;
        mapaDePara[`Profissional [PROF-${pad2}]`] = nomeLimpo;
        mapaDePara[`Profissional PROF-${pad2}`] = nomeLimpo;

        if (idOriginal && idOriginal.length >= 4) {
          mapaDePara[idOriginal] = nomeLimpo;
        }
      };

      const registrarVariacoesPaciente = (indice: number, nomeReal: string, idOriginal?: string) => {
        if (!nomeReal) return;
        const nomeLimpo = nomeReal.trim();
        const pad3 = String(indice).padStart(3, '0');
        const pad2 = String(indice).padStart(2, '0');
        const numStr = String(indice);

        // Variações com PAC-XXX e PAC-XX (ex: [PAC-016], [PAC-01], [PAC-1], PAC-016, PAC-01)
        mapaDePara[`[PAC-${pad3}]`] = nomeLimpo;
        mapaDePara[`[PAC-${pad2}]`] = nomeLimpo;
        mapaDePara[`[PAC-${numStr}]`] = nomeLimpo;
        mapaDePara[`PAC-${pad3}`] = nomeLimpo;
        mapaDePara[`PAC-${pad2}`] = nomeLimpo;
        mapaDePara[`PAC-${numStr}`] = nomeLimpo;

        // Variações com PAC_XX
        mapaDePara[`[PAC_${pad3}]`] = nomeLimpo;
        mapaDePara[`[PAC_${pad2}]`] = nomeLimpo;
        mapaDePara[`[PAC_${numStr}]`] = nomeLimpo;
        mapaDePara[`PAC_${pad3}`] = nomeLimpo;
        mapaDePara[`PAC_${pad2}`] = nomeLimpo;
        mapaDePara[`PAC_${numStr}`] = nomeLimpo;

        // Variações com prefixo literal "Paciente"
        mapaDePara[`Paciente [PAC-${pad3}]`] = nomeLimpo;
        mapaDePara[`Paciente [PAC-${pad2}]`] = nomeLimpo;
        mapaDePara[`Paciente [PAC-${numStr}]`] = nomeLimpo;
        mapaDePara[`Paciente PAC-${pad3}`] = nomeLimpo;
        mapaDePara[`Paciente PAC-${pad2}`] = nomeLimpo;
        mapaDePara[`Paciente PAC-${numStr}`] = nomeLimpo;
        mapaDePara[`Paciente [PAC_${pad2}]`] = nomeLimpo;
        mapaDePara[`Paciente PAC_${pad2}`] = nomeLimpo;

        if (idOriginal && idOriginal.length >= 4) {
          mapaDePara[idOriginal] = nomeLimpo;
        }
      };

      let profCounter = 1;
      const profIdParaPseudonimo = new Map<string, string>();
      const profNomeParaPseudonimo = new Map<string, string>();

      const obterPseudonimoProf = (id?: string, nome?: string): string => {
        const kId = String(id || '').trim();
        const kNome = String(nome || '').trim().toLowerCase();
        if (kId && profIdParaPseudonimo.has(kId)) return profIdParaPseudonimo.get(kId)!;
        if (kNome && profNomeParaPseudonimo.has(kNome)) return profNomeParaPseudonimo.get(kNome)!;

        const indice = profCounter++;
        const pseudonimo = `P-${String(indice).padStart(2, '0')}`;
        if (kId) profIdParaPseudonimo.set(kId, pseudonimo);
        if (kNome) profNomeParaPseudonimo.set(kNome, pseudonimo);

        const nomeReal = String(nome || '').trim();
        if (nomeReal) {
          registrarVariacoesProfissional(indice, nomeReal, kId);
        }
        return pseudonimo;
      };

      let pacCounter = 1;
      const pacIdParaPseudonimo = new Map<string, string>();
      const pacNomeParaPseudonimo = new Map<string, string>();

      const obterPseudonimoPac = (id?: string, nome?: string): string => {
        const kId = String(id || '').trim();
        const kNome = String(nome || '').trim().toLowerCase();
        if (kId && pacIdParaPseudonimo.has(kId)) return pacIdParaPseudonimo.get(kId)!;
        if (kNome && pacNomeParaPseudonimo.has(kNome)) return pacNomeParaPseudonimo.get(kNome)!;

        const indice = pacCounter++;
        const pseudonimo = `PAC-${String(indice).padStart(2, '0')}`;
        if (kId) pacIdParaPseudonimo.set(kId, pseudonimo);
        if (kNome) pacNomeParaPseudonimo.set(kNome, pseudonimo);

        const nomeReal = String(nome || '').trim();
        if (nomeReal) {
          registrarVariacoesPaciente(indice, nomeReal, kId);
        }
        return pseudonimo;
      };

      // Mapear todos os profissionais da base para garantir de-para completo de todos os códigos [P-XX]
      listaProfissionais.forEach(p => {
        const pAny = p as any;
        const nomeReal = String(p.nome || pAny.nomeCompleto || pAny.nomeProfissional || pAny.name || '').trim();
        const pseudonimo = obterPseudonimoProf(p.id, nomeReal);
        if (nomeReal) {
          const match = pseudonimo.match(/\d+/);
          const idx = match ? parseInt(match[0], 10) : 0;
          if (idx > 0) {
            registrarVariacoesProfissional(idx, nomeReal, p.id);
          }
        }
      });

      // Mapear todos os pacientes da base
      listaPacientes.forEach(p => {
        const pAny = p as any;
        const nomeReal = String(p.nome || pAny.nomeCompleto || pAny.name || '').trim();
        const pseudonimo = obterPseudonimoPac(p.id, nomeReal);
        if (nomeReal) {
          const match = pseudonimo.match(/\d+/);
          const idx = match ? parseInt(match[0], 10) : 0;
          if (idx > 0) {
            registrarVariacoesPaciente(idx, nomeReal, p.id);
          }
        }
      });

      // Montar profissionais pseudonimizados
      const profissionaisPseudonimizados = listaProfissionais.map(prof => {
        const pAny = prof as any;
        const pseudonimo = obterPseudonimoProf(prof.id, prof.nome || pAny.nomeCompleto);
        return {
          id: pseudonimo,
          nome: pseudonimo,
          categoria: pAny.categoria || pAny.funcao || pAny.profissao || 'Cuidador',
          especialidade: prof.especialidade || 'Geral',
          status: prof.status || 'Disponível',
          valorHora: Number(pAny.valorHora || pAny.valorPlantao || 0),
          plantoesRealizadosMes: Number(pAny.plantoesRealizadosMes || pAny.totalPlantoes || 0)
        };
      });

      // Montar pacientes pseudonimizados com decomposição detalhada de custos unitários por plantão
      const pacientesPseudonimizados = listaPacientes.map(pac => {
        const pAny = pac as any;
        const pseudonimo = obterPseudonimoPac(pac.id, pac.nome || pAny.nomeCompleto);

        // Decomposição de custos unitários cadastrados na ficha do paciente (coleção 'pacientes')
        const plano = pac.planoAtendimento || pAny.planoAtendimento || {};
        const tipos = Array.isArray(plano.tiposPlantao) ? plano.tiposPlantao : [];
        const principal = tipos.find((t: any) => t.isPrincipal) || tipos[0] || {};

        // Repasse ao cuidador/profissional por plantão
        const valorPlantaoProfissional = Number(
          principal.valorPlantao ||
          principal.repasseProfissional ||
          principal.valorDiaria ||
          principal.valorProfissional ||
          plano.valorSugeridoPlantao ||
          plano.valorPlantao ||
          plano.repasseProfissional ||
          plano.valorDiaria ||
          plano.valorProfissional ||
          pAny.valorPlantaoProfissional ||
          pAny.repasseProfissional ||
          pAny.valorDiaria ||
          pAny.valorPlantao ||
          pAny.valorSugeridoPlantao ||
          pAny.valorProfissional ||
          pAny.repasse ||
          0
        );

        // Ajuda de custo de transporte/alimentação
        const valorAjudaCusto = Number(
          principal.ajudaCusto ||
          principal.valorTransporte ||
          principal.valorAlimentacao ||
          principal.transporte ||
          principal.adicional ||
          plano.ajudaCusto ||
          plano.valorTransporte ||
          plano.valorAlimentacao ||
          plano.transporte ||
          plano.adicional ||
          plano.valorAjudaCusto ||
          pAny.ajudaCusto ||
          pAny.valorAjudaCusto ||
          pAny.ajudaDeCusto ||
          pAny.transporte ||
          pAny.valorTransporte ||
          pAny.alimentacao ||
          pAny.valorAlimentacao ||
          pAny.adicional ||
          0
        );

        // Taxa administrativa / margem de gestão
        const taxaAdministrativa = Number(
          principal.taxaAdm ||
          principal.taxaAdministrativa ||
          plano.taxaAdm ||
          plano.taxaAdministrativa ||
          pAny.taxaAdm ||
          pAny.taxaAdministrativa ||
          0
        );

        // Valor total cobrado por plantão
        const valorTotalCobradoPlantao = Number(
          principal.valorCobrado ||
          principal.valorHora ||
          plano.valorTotalCobradoPlantao ||
          plano.valorCobrado ||
          plano.valorHora ||
          pAny.valorTotalCobradoPlantao ||
          pAny.valorCobradoPlantao ||
          pAny.valorCobrado ||
          pAny.valorHora ||
          (valorPlantaoProfissional + valorAjudaCusto + taxaAdministrativa)
        );

        return {
          id: pseudonimo,
          nome: pseudonimo,
          status: pac.status || 'Ativo',
          complexidade: pAny.complexidade || pAny.grauComplexidade || pAny.informacoesMedicas?.grauDependencia || 'Média',
          planoCuidado: pAny.planoCuidado || pAny.tipoPlantao || pAny.planoAtendimento?.tipoEscala || 'Plantão 12h',
          quantidadePlantoesMes: Number(pAny.quantidadePlantoesMes || pAny.plantoesMes || 0),
          valorMensal: Number(pAny.valorMensal || pAny.mensalidade || pAny.valorTotal || 0),
          especialidade: pAny.especialidade || pAny.categoriaNecessaria || 'Técnico de Enfermagem',
          valorPlantaoProfissional,
          valorAjudaCusto,
          taxaAdministrativa,
          valorTotalCobradoPlantao
        };
      });

      // Garantir de-para para nomes e IDs presentes em agendamentos e faturas
      (agendamentos || []).forEach(e => {
        const eAny = e as any;
        const profId = e.idProfissional || eAny.profissionalId || eAny.cuidadorId || eAny.funcionarioId;
        let profNome = e.nomeProfissional || eAny.profissionalNome || eAny.nomeCuidador || eAny.nomeFuncionario;
        if (!profNome && profId) {
          profNome = mapaProfissionaisCadastrados.get(String(profId).trim());
        }
        if (profNome || profId) {
          obterPseudonimoProf(profId, profNome);
        }

        const pacId = e.idPaciente || eAny.pacienteId || eAny.idClient;
        let pacNome = eAny.nomePaciente || eAny.pacienteNome;
        if (!pacNome && pacId) {
          pacNome = mapaPacientesCadastrados.get(String(pacId).trim());
        }
        if (pacNome || pacId) {
          obterPseudonimoPac(pacId, pacNome);
        }
      });

      // 1. Agregação Matemática Prévia no Frontend (Ultrarrápida, escalável e segura)
      // a) Detectar período solicitado na pergunta (ex: "agosto", "julho", "2026" ou padrão Setembro/2026)
      const periodoDetectado = detectarPeriodoConsulta(textoParaEnviar, faturasPacientes || [], listaEscalasEfetiva || []);

      // Carregar todas as escalas para o conjunto completo da empresa
      let todosAgendamentos: any[] = [...listaEscalasEfetiva];
      try {
        if (todosAgendamentos.length === 0) {
          const agSnap = await getDocs(query(collection(db, 'agendamentos'), limit(3000)));
          const docsAg: any[] = [];
          agSnap.forEach(d => {
            docsAg.push({ ...d.data(), id: d.id });
          });
          if (docsAg.length > 0) {
            todosAgendamentos = docsAg;
          }
        }
      } catch (err) {
        console.warn('[AnaliseInteligente] Busca de agendamentos para o período ativo:', err);
      }

      // b) Filtrar faturas e agendamentos pelo período detectado
      // Verificar se o usuário mencionou explicitamente outro mês diferente do mês corrente (Setembro/2026)
      const pedeOutroMes = periodoDetectado.meses.length > 0 && 
        !periodoDetectado.meses.some(m => m.mes === 9 && m.ano === 2026) &&
        !textoParaEnviar.toLowerCase().includes('mês atual') &&
        !textoParaEnviar.toLowerCase().includes('mes atual');

      let agendamentosDoPeriodo: any[] = [];
      let periodoDescricao = 'Setembro de 2026';

      if (pedeOutroMes) {
        agendamentosDoPeriodo = todosAgendamentos.filter(e => {
          return dataPertenceAoPeriodo(e.data || e.dataInicio || e.dataPrevista, undefined, periodoDetectado.meses);
        });
        periodoDescricao = periodoDetectado.descricao;
      } else {
        // Mês corrente (Setembro/2026: 01/09/2026 até 30/09/2026)
        agendamentosDoPeriodo = todosAgendamentos.filter(e => {
          const dataVal = e.data || e.dataInicio || e.dataPrevista;
          return pertenceAoIntervalo(dataVal, '2026-09-01', '2026-09-30');
        });
      }

      // Se o filtro do mês não encontrou registros específicos na base, utiliza a base completa de agendamentos
      if (agendamentosDoPeriodo.length === 0 && todosAgendamentos.length > 0) {
        agendamentosDoPeriodo = todosAgendamentos;
      }

      const faturasDoPeriodo = (faturasPacientes || []).filter(f => {
        const fatAny = f as any;
        return dataPertenceAoPeriodo(
          f.dataEmissao || f.periodoApurado?.fim || fatAny.createdAt || fatAny.criadoEm,
          f.mesReferencia,
          pedeOutroMes ? periodoDetectado.meses : [{ ano: 2026, mes: 9 }]
        );
      });

      // =========================================================================================
      // 1. Script de Auditoria Determinístico nos dados do Firestore (Extração Completa e Rígida)
      // =========================================================================================
      const escalasDescobertas: Array<{
        tipo: string;
        pacienteCodigo: string;
        pacienteNomeOriginal?: string;
        data: string;
        turno: string;
        diaSemana: string;
      }> = [];

      const escalasFimDeSemanaDetectadas: any[] = [];
      const curingasPorProfissional: Record<string, number> = {};
      const curingasPorPaciente: Record<string, number> = {};
      const curingasPorDiaSemana: Record<string, number> = {
        'Segunda-feira': 0,
        'Terça-feira': 0,
        'Quarta-feira': 0,
        'Quinta-feira': 0,
        'Sexta-feira': 0,
        'Sábado': 0,
        'Domingo': 0
      };

      // Montar array de escalas estruturado com pacienteCodigo, data, diaSemana, turno, statusAlocacao e curinga
      const escalasParaEnvio = agendamentosDoPeriodo.map(e => {
        const eAny = e as any;
        const pacId = e.idPaciente || eAny.pacienteId || eAny.idClient;
        let pacNome = eAny.nomePaciente || eAny.pacienteNome || eAny.paciente;
        if (!pacNome && pacId) {
          pacNome = mapaPacientesCadastrados.get(String(pacId).trim());
        }
        const pacienteCodigo = obterPseudonimoPac(pacId, pacNome);

        const profId = e.idProfissional || eAny.profissionalId || eAny.cuidadorId || eAny.funcionarioId;
        let profNome = e.nomeProfissional || eAny.profissionalNome || eAny.nomeCuidador || eAny.nomeFuncionario;
        if (!profNome && profId) {
          profNome = mapaProfissionaisCadastrados.get(String(profId).trim());
        }
        const profissionalCodigo = (profNome || profId) ? obterPseudonimoProf(profId, profNome) : undefined;

        const { data: dataIso, diaSemana } = extrairDataIsoEDiaSemana(e.data || eAny.dataInicio || eAny.dataPrevista);
        const alocada = isEscalaAlocada(e);
        const statusAlocacao = alocada ? 'completa' : 'incompleta';
        const curinga = isEscalaCuringa(e);
        const turno = String(e.horario || eAny.tipoTurno || eAny.turno || '12h Diurno').trim();

        // Se campo de profissional vazio/aberto, registrar em escalasDescobertas
        if (!alocada) {
          escalasDescobertas.push({
            tipo: "ESCALA_VAGA",
            pacienteCodigo,
            pacienteNomeOriginal: pacNome,
            data: dataIso,
            turno,
            diaSemana
          });
        }

        // Identificar escalas de fim de semana (Sábado/Domingo)
        if (diaSemana === 'Sábado' || diaSemana === 'Domingo') {
          escalasFimDeSemanaDetectadas.push({
            pacienteCodigo,
            data: dataIso,
            diaSemana,
            turno,
            alocada,
            curinga
          });
        }

        // Contar ocorrências reais de curinga: true agrupadas por profissional e paciente
        if (curinga) {
          const chaveProf = profissionalCodigo || 'Sem Profissional Atribuído';
          curingasPorProfissional[chaveProf] = (curingasPorProfissional[chaveProf] || 0) + 1;
          curingasPorPaciente[pacienteCodigo] = (curingasPorPaciente[pacienteCodigo] || 0) + 1;
          if (curingasPorDiaSemana[diaSemana] !== undefined) {
            curingasPorDiaSemana[diaSemana]++;
          }
        }

        return {
          pacienteCodigo,
          data: dataIso,
          diaSemana,
          turno,
          statusAlocacao,
          curinga
        };
      });

      // Calcule os números consolidados finais: totalEscalas, escalasPreenchidas, escalasVagas, taxaOcupacaoReal
      const totalEscalas = agendamentosDoPeriodo.length;
      const escalasPreenchidas = agendamentosDoPeriodo.filter(isEscalaAlocada).length;
      const escalasVagas = escalasDescobertas.length;
      const totalCuringas = agendamentosDoPeriodo.filter(isEscalaCuringa).length;
      const taxaOcupacaoReal = totalEscalas > 0 ? Number(((escalasPreenchidas / totalEscalas) * 100).toFixed(1)) : 100;

      // Pacientes ativos vinculados à empresa (sem limites artificiais)
      const pacientesAtivos = listaPacientes.filter(p => {
        const st = String(p.status || 'Ativo').toLowerCase().trim();
        return st !== 'inativo' && st !== 'desativado' && st !== 'cancelado';
      });
      const pacientesAlvo = pacientesAtivos.length > 0 ? pacientesAtivos : listaPacientes;
      const totalPacientesAtivos = pacientesAtivos.length > 0 ? pacientesAtivos.length : listaPacientes.length;

      // Identificar o dia da semana com mais curingas
      let diaComMaisCuringas = 'Sábado';
      let maxCuringasNoDia = 0;
      Object.entries(curingasPorDiaSemana).forEach(([dia, qtd]) => {
        if (qtd > maxCuringasNoDia) {
          maxCuringasNoDia = qtd;
          diaComMaisCuringas = dia;
        }
      });

      const metricasExatas = {
        total: totalEscalas,
        preenchidas: escalasPreenchidas,
        vagas: escalasVagas,
        curingas: totalCuringas,
        pacientesAtivosTotal: totalPacientesAtivos
      };

      const alertasCriticos = escalasDescobertas.map(e => ({
        tipo: "ESCALA_VAGA",
        pacienteId: e.pacienteCodigo,
        pacienteNome: e.pacienteNomeOriginal,
        data: e.data,
        turno: e.turno
      }));

      const padroesDetectados = {
        diaComMaisCuringas,
        totalNoDia: maxCuringasNoDia,
        escalasFimDeSemana: {
          total: escalasFimDeSemanaDetectadas.length,
          vagas: escalasFimDeSemanaDetectadas.filter(e => !e.alocada).length
        },
        curingasPorProfissional,
        curingasPorPaciente
      };

      const metricasAuditadas = {
        totalEscalasMes: totalEscalas,
        concluidas: escalasPreenchidas,
        vagas: escalasVagas,
        curingas: totalCuringas,
        pacientesAtivosTotal: totalPacientesAtivos
      };

      // d) Calcular faturamento, custos e margem por paciente
      const resumoFinanceiro: Array<{
        id: string;
        faturamento: number;
        custoProf: number;
        ajudaCusto: number;
        totalCustos: number;
        lucro: number;
        margem: number;
      }> = [];

      pacientesAlvo.forEach(pac => {
        const pAny = pac as any;
        const pacIdStr = String(pac.id || '').trim();
        const pacNomeStr = String(pac.nome || pAny.nomeCompleto || '').trim().toLowerCase();
        const pseudonimo = obterPseudonimoPac(pac.id, pac.nome || pAny.nomeCompleto);

        const pertenceAoPaciente = (idTest?: any, nomeTest?: any) => {
          const id = String(idTest || '').trim();
          if (id && pacIdStr && id === pacIdStr) return true;
          const nome = String(nomeTest || '').trim().toLowerCase();
          if (nome && pacNomeStr && (nome === pacNomeStr || nome.includes(pacNomeStr) || pacNomeStr.includes(nome))) return true;
          return false;
        };

        // Custos unitários cadastrados na ficha do paciente
        const plano = pac.planoAtendimento || pAny.planoAtendimento || {};
        const tipos = Array.isArray(plano.tiposPlantao) ? plano.tiposPlantao : [];
        const principal = tipos.find((t: any) => t.isPrincipal) || tipos[0] || {};

        const valorPlantaoUnitario = Number(
          principal.valorPlantao ||
          principal.repasseProfissional ||
          principal.valorDiaria ||
          principal.valorProfissional ||
          plano.valorSugeridoPlantao ||
          plano.valorPlantao ||
          pAny.valorPlantaoProfissional ||
          pAny.repasseProfissional ||
          pAny.valorPlantao ||
          0
        );

        const valorAjudaCustoUnitario = Number(
          principal.ajudaCusto ||
          principal.valorTransporte ||
          principal.transporte ||
          principal.adicional ||
          plano.ajudaCusto ||
          plano.valorTransporte ||
          pAny.valorAjudaCusto ||
          pAny.ajudaCusto ||
          pAny.valorTransporte ||
          0
        );

        const taxaAdmUnitario = Number(
          principal.taxaAdm ||
          principal.taxaAdministrativa ||
          plano.taxaAdm ||
          plano.taxaAdministrativa ||
          pAny.taxaAdministrativa ||
          pAny.taxaAdm ||
          0
        );

        const valorCobradoUnitario = Number(
          principal.valorCobrado ||
          principal.valorHora ||
          plano.valorTotalCobradoPlantao ||
          plano.valorCobrado ||
          pAny.valorTotalCobradoPlantao ||
          pAny.valorCobrado ||
          (valorPlantaoUnitario + valorAjudaCustoUnitario + taxaAdmUnitario)
        );

        // Faturamento Total: soma das faturas do paciente no período selecionado
        const faturasDoPac = faturasDoPeriodo.filter(f => pertenceAoPaciente(f.idPaciente || f.pacienteId, f.nomePaciente));
        let faturamentoTotal = faturasDoPac.reduce((sum, f) => sum + (Number(f.valorTotal) || 0), 0);

        // Escalas do paciente no período
        const agendamentosDoPac = agendamentosDoPeriodo.filter(e => {
          const eAny = e as any;
          return pertenceAoPaciente(e.idPaciente || eAny.pacienteId || eAny.idClient, eAny.nomePaciente || eAny.pacienteNome || eAny.paciente);
        });

        let custoProfissionaisTotal = 0;
        let ajudaCustoTotal = 0;

        if (agendamentosDoPac.length > 0) {
          agendamentosDoPac.forEach(e => {
            const eAny = e as any;
            const repasse = Number(
              e.valorRepasse ||
              e.valorPlantao ||
              eAny.valorProfissional ||
              eAny.repasseProfissional ||
              valorPlantaoUnitario ||
              0
            );
            const ajuda = Number(
              e.ajudaCusto ||
              eAny.valorTransporte ||
              eAny.transporte ||
              eAny.adicional ||
              valorAjudaCustoUnitario ||
              0
            );
            custoProfissionaisTotal += repasse;
            ajudaCustoTotal += ajuda;
          });

          // Se faturamentoTotal nas faturas estiver zerado, apurar pelos plantões realizados
          if (faturamentoTotal === 0) {
            faturamentoTotal = agendamentosDoPac.reduce((sum, e) => {
              const eAny = e as any;
              const cobrado = Number(
                eAny.valorCobrado ||
                eAny.valorFaturado ||
                valorCobradoUnitario ||
                (Number(e.valorPlantao || 0) + Number(e.ajudaCusto || 0) + Number(e.taxaAdm || 0))
              );
              return sum + cobrado;
            }, 0);
          }
        } else {
          // Paciente ativo sem escalas específicas no período: usa quantidade estimada mensal
          const qtdPlantoes = Number(pAny.quantidadePlantoesMes || pAny.plantoesMes || 0);
          if (qtdPlantoes > 0) {
            custoProfissionaisTotal = qtdPlantoes * valorPlantaoUnitario;
            ajudaCustoTotal = qtdPlantoes * valorAjudaCustoUnitario;
            if (faturamentoTotal === 0) {
              faturamentoTotal = qtdPlantoes * valorCobradoUnitario;
            }
          } else if (faturamentoTotal === 0) {
            faturamentoTotal = Number(pAny.valorMensal || pAny.mensalidade || pAny.valorTotal || 0);
          }
        }

        const custosTotais = custoProfissionaisTotal + ajudaCustoTotal;
        const lucroOperacional = faturamentoTotal - custosTotais;
        const margemPercentual = faturamentoTotal > 0 ? (lucroOperacional / faturamentoTotal) * 100 : 0;

        resumoFinanceiro.push({
          id: pseudonimo,
          faturamento: Math.round(faturamentoTotal * 100) / 100,
          custoProf: Math.round(custoProfissionaisTotal * 100) / 100,
          ajudaCusto: Math.round(ajudaCustoTotal * 100) / 100,
          totalCustos: Math.round(custosTotais * 100) / 100,
          lucro: Math.round(lucroOperacional * 100) / 100,
          margem: Math.round(margemPercentual * 10) / 10
        });
      });

      // 2. Camada de Agregação Determinística Prévia (Elimina alucinações e otimiza tokens)
      const agregacaoOperacional = calcularAgregacaoOperacional(
        escalasParaEnvio,
        pacientesAlvo,
        profissionaisPseudonimizados,
        faturasDoPeriodo,
        debitosProfissionais || []
      );

      // 3. Envio Estruturado e Agregado para a Cloud Function com Métricas Auditadas Determinísticas
      const dadosParaEnvio = {
        periodo: periodoDescricao,
        periodoReferencia: periodoDescricao,
        metricasExatas,
        alertasCriticos,
        padroesDetectados,
        metricasAuditadas,
        totalEscalasMes: metricasAuditadas.totalEscalasMes,
        concluidas: metricasAuditadas.concluidas,
        vagas: metricasAuditadas.vagas,
        curingas: metricasAuditadas.curingas,
        pacientesAtivosTotal: metricasAuditadas.pacientesAtivosTotal,
        resumoFinanceiro,
        resumoGeral: {
          ...agregacaoOperacional.resumoGeral,
          totalPacientes: metricasAuditadas.pacientesAtivosTotal,
          totalEscalas: metricasAuditadas.totalEscalasMes
        },
        escalasPorDiaSemana: agregacaoOperacional.escalasPorDiaSemana,
        escalasFimDeSemana: agregacaoOperacional.escalasFimDeSemana,
        gargalosEscala: {
          ...agregacaoOperacional.gargalosEscala,
          escalasCompletasTotal: metricasAuditadas.concluidas,
          escalasVagasTotal: metricasAuditadas.vagas,
          taxaOcupacaoPercentual: taxaOcupacaoReal
        },
        estatisticasCuringas: {
          ...agregacaoOperacional.estatisticasCuringas,
          total: metricasAuditadas.curingas
        },
        financeiroConsolidado: agregacaoOperacional.financeiroConsolidado,
        pacientes: pacientesPseudonimizados.slice(0, 25),
        profissionais: profissionaisPseudonimizados.slice(0, 25),
        // Enviar APENAS exceções operacionais (escalas vagas e plantões curinga), eliminando centenas de escalas normais
        escalas: escalasParaEnvio.filter(e => e.statusAlocacao !== 'completa' || e.curinga),
        escalasVagas: escalasParaEnvio.filter(e => e.statusAlocacao !== 'completa'),
        plantoesCuringa: escalasParaEnvio.filter(e => e.curinga),
        debitosProfissionais: [],
        faturasPacientes: [],
        folhasPagamento: [],
        totaisConsolidados: {
          totalEscalasMes: totalEscalas,
          concluidas: escalasPreenchidas,
          vagas: escalasVagas,
          curingas: totalCuringas,
          pacientesAtivosTotal: totalPacientesAtivos,
          taxaOcupacaoPercentual: taxaOcupacaoReal,
          faturamentoMensalConsolidado: metricasSumarizadas.faturamentoConsolidado,
          custoTotalFolhaConsolidado: metricasSumarizadas.custoFolhaConsolidado,
          totalDebitosProfissionais: metricasSumarizadas.totalDebitos
        },
        user: {
          email: user?.email || '',
          role: userRole || ''
        }
      };

      // Contexto imediato estrito (sem histórico acumulado para evitar explosão de tokens):
      // Envia apenas a pergunta atual e, se houver, apenas a última resposta imediata resumida
      const ultimaRespostaObj = [...mensagens].reverse().find(m => m.tipo === 'resposta');
      const contextoUltimaResposta = ultimaRespostaObj?.texto
        ? `\n\n[Contexto da resposta imediatamente anterior: "${ultimaRespostaObj.texto.slice(0, 250)}..."]\n`
        : '';

      // Diretriz rigorosa de auditoria determinística para eliminar alucinações e recalculos indevidos
      const promptComAuditoria = `Você é o Diretor de Operações e Auditoria da Vallidare Home Care.
Sua missão é emitir diagnósticos operacionais de alta precisão baseando-se EXCLUSIVAMENTE nas 'metricasExatas' e 'alertasCriticos' fornecidos.

Diretrizes:
- Seja ultra conciso, direto e executivo. Responda em no máximo 3 parágrafos curtos ou tópicos objetivos com tabela resumida. Elimine saudações formais, introduções óbvias ou conclusões prolixas.
- Nunca altere ou estime os números de escalas e pacientes. Se a métrica informa ${metricasExatas.vagas} vagas, aponte exatamente ${metricasExatas.vagas} vagas. Se o total é ${metricasExatas.total} escalas, afirme exatamente ${metricasExatas.total}.
- Se houver alertas críticos (escalas vagas ou alta taxa de curingas), priorize-os logo no primeiro parágrafo com ações recomendadas.
- Formate a resposta de forma executiva com listas em tópicos e tabelas claras em Markdown.

Diagnóstico Estruturado de Auditoria (${periodoDescricao}):
${JSON.stringify({
  periodo: periodoDescricao,
  metricasExatas,
  alertasCriticos: alertasCriticos.slice(0, 20),
  padroesDetectados
}, null, 2)}

Consulta atual do gestor a ser respondida com base estrita nestas métricas:
${textoParaEnviar}${contextoUltimaResposta}`;

      const resultado = await consultarAssistenteOperacional(promptComAuditoria, dadosParaEnvio);

      // 2. Reversão Local ao Exibir a Resposta (Privacy by Design / Client-side Resolution)
      let textoFinal = resultado.resposta || 'Não foi possível gerar uma resposta para os dados informados.';

      // Ordenação das chaves pelo comprimento em ordem decrescente para evitar substituições parciais (ex: [PAC-016] e [PAC-01])
      const chavesOrdenadas = Object.keys(mapaDePara).sort((a, b) => b.length - a.length);
      chavesOrdenadas.forEach((codigo) => {
        if (codigo && mapaDePara[codigo]) {
          textoFinal = textoFinal.split(codigo).join(mapaDePara[codigo]);
        }
      });

      const novaMensagemResposta: MensagemInterativa = {
        id: `resp-${Date.now()}`,
        tipo: 'resposta',
        texto: textoFinal,
        timestamp: resultado.timestamp || new Date().toISOString()
      };

      setMensagens(prev => [...prev, novaMensagemResposta]);
    } catch (err: any) {
      console.error('[AssistenteOperacional] Falha na requisição operacional');
      setErro(err?.message || 'Falha ao processar a consulta operacional.');
    } finally {
      setLoading(false);
      setLoadingStep('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleConsultar();
    }
  };

  const handleCopiar = (id: string, texto: string) => {
    navigator.clipboard.writeText(texto);
    setCopiadoId(id);
    setTimeout(() => setCopiadoId(null), 2500);
  };

  const handleLimparConversa = () => {
    setMensagens([]);
    setErro(null);
    setPerguntaInput('');
  };

  const handleImprimir = () => {
    window.print();
  };

  // Categorias de Consultas Rápidas para o Menu Dropdown
  const CATEGORIAS_CONSULTAS_RAPIDAS = [
    {
      categoria: 'Escalas e Plantões',
      icone: Calendar,
      itens: [
        {
          rotulo: 'Gargalos de Escala',
          descricao: 'Identificar turnos sem alocação e lacunas de cobertura',
          pergunta: 'Identifique os principais gargalos de escalas e aponte os turnos ou plantões sem profissional alocado.'
        },
        {
          rotulo: 'Plantões de Fim de Semana',
          descricao: 'Pacientes com escalas aos sábados e domingos e respectivos turnos',
          pergunta: 'Quais pacientes têm plantão aos sábados e domingos? Apresente a lista com seus respectivos turnos e o status de alocação.'
        },
        {
          rotulo: 'Conflitos de Horários',
          descricao: 'Verificar sobreposições de turnos e riscos de sobrecarga assistencial',
          pergunta: 'Identifique possíveis conflitos de horários, turnos consecutivos e riscos de sobrecarga assistencial.'
        }
      ]
    },
    {
      categoria: 'Substituições',
      icone: Users,
      itens: [
        {
          rotulo: 'Métricas de Curingas no Mês',
          descricao: 'Volume de plantões curingas e distribuição percentual por dia da semana',
          pergunta: 'Apresente as métricas de plantões curingas no período, quantidade total e a distribuição percentual por dia da semana.'
        },
        {
          rotulo: 'Dias de Maior Demanda',
          descricao: 'Concentração e ranking de plantões por dia da semana',
          pergunta: 'Apresente a distribuição e o ranking dos dias da semana com maior volume de plantões e escalas ativas.'
        }
      ]
    },
    {
      categoria: 'Financeiro e Visão Geral',
      icone: TrendingUp,
      itens: [
        {
          rotulo: 'Resumo Geral Operacional',
          descricao: 'Visão macro da operação de Home Care e capacidade da equipe',
          pergunta: 'Apresente um resumo geral da operação de Home Care, volume de atendimentos e capacidade da equipe.'
        },
        {
          rotulo: 'Análise de Custos e Plantões',
          descricao: 'Repasses a profissionais e custos operacionais dos plantões',
          pergunta: 'Faça uma análise de custos dos plantões, relação com repasses a profissionais e previsão de margem.'
        },
        {
          rotulo: 'Margem de Lucro por Paciente',
          descricao: 'Tabela de faturamento, custos e margem percentual ordenada',
          pergunta: 'Apresente uma análise detalhada da margem de lucro por paciente ativo no mês atual e no mês anterior. Exiba em tabela separando faturamento, custo com cuidadores, ajuda de custo total, custos totais, lucro operacional em R$ e margem percentual, ordenando da maior para a menor margem.'
        }
      ]
    }
  ];

  const handleSelecionarConsultaRapida = (pergunta: string) => {
    setDropdownAberto(false);
    setPerguntaInput(pergunta);
    handleConsultar(pergunta);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden" id="card-assistente-operacional">
      {/* Cabeçalho da Seção */}
      <div className="p-3.5 sm:p-6 border-b border-slate-100 bg-gradient-to-r from-slate-50 via-white to-blue-50/20">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4">
          <div className="flex items-start gap-2.5 sm:gap-3">
            <div className="p-2 sm:p-2.5 bg-blue-600 text-white rounded-lg shadow-sm shrink-0">
              <Bot className="w-5 h-5 sm:w-6 h-6" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-col gap-1.5">
                <h3 className="text-base sm:text-lg font-bold text-slate-800 leading-tight">
                  Assistente de Inteligência Operacional
                </h3>
                {/* Badges de conformidade: formato horizontal rolável em telas pequenas */}
                <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto whitespace-nowrap pb-1 no-scrollbar sm:flex-wrap">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs sm:text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200 shrink-0">
                    <ShieldCheck className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                    Restrito
                  </span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs sm:text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200 shrink-0" title="A IA recebe apenas pseudônimos opacos e o navegador reverte para os nomes reais localmente na sua máquina">
                    <Lock className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                    <span className="sm:hidden">LGPD Reversível</span>
                    <span className="hidden sm:inline">Pseudonimização Reversível no Cliente (LGPD)</span>
                  </span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs sm:text-xs font-semibold bg-purple-100 text-purple-800 border border-purple-200 shrink-0">
                    <Trash2 className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                    <span className="sm:hidden">Efêmero</span>
                    <span className="hidden sm:inline">Efemeridade Total (Memória Volátil)</span>
                  </span>
                </div>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-3xl leading-relaxed">
                Consulte métricas operacionais em tempo real, verifique gargalos de escalas, custos de plantões e faça perguntas livres com garantia de sigilo de dados e efemeridade total (nenhum registro é salvo no banco ou navegador).
              </p>
            </div>
          </div>

          {mensagens.length > 0 && (
            <div className="flex items-center gap-2 shrink-0 self-start md:self-center pt-1 md:pt-0">
              <button
                type="button"
                onClick={handleLimparConversa}
                className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 transition-colors shadow-2xs"
                title="Iniciar nova consulta e limpar memória transitória"
              >
                <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
                <span>Nova consulta</span>
              </button>
              <button
                type="button"
                onClick={handleImprimir}
                className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-2xs"
                title="Imprimir relatório"
              >
                <Printer className="w-3.5 h-3.5 text-slate-400" />
                <span className="hidden sm:inline">Imprimir</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Painel de Métricas Rápidas (Contexto da Operação) */}
      <div className="p-3 sm:p-5 bg-slate-50/60 border-b border-slate-200">
        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5 text-blue-500" />
            Dados Operacionais Auditados • Setembro/2026
          </div>
          {carregandoBase && (
            <span className="text-2xs text-blue-600 font-normal flex items-center gap-1">
              <RefreshCw className="w-3 h-3 animate-spin" /> Atualizando base...
            </span>
          )}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
          <div className="bg-white py-2 px-2.5 sm:p-3 rounded-lg border border-slate-200 shadow-2xs">
            <div className="flex items-center gap-1.5 text-slate-500 text-xs font-medium truncate">
              <Users className="w-3.5 h-3.5 text-blue-500 shrink-0" />
              <span>Pacientes Ativos</span>
            </div>
            <div className="text-lg sm:text-xl font-bold text-slate-800 mt-0.5 sm:mt-1">
              {metricasSumarizadas.pacAtivos}
            </div>
            <div className="text-2xs sm:text-xs text-emerald-600 font-medium truncate">
              {metricasSumarizadas.pacAtivos} ativos ({metricasSumarizadas.totalPac} cadastrados)
            </div>
          </div>

          <div className="bg-white py-2 px-2.5 sm:p-3 rounded-lg border border-slate-200 shadow-2xs">
            <div className="flex items-center gap-1.5 text-slate-500 text-xs font-medium truncate">
              <Users className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
              <span>Profissionais</span>
            </div>
            <div className="text-lg sm:text-xl font-bold text-slate-800 mt-0.5 sm:mt-1">
              {metricasSumarizadas.totalProf}
            </div>
            <div className="text-2xs sm:text-xs text-indigo-600 font-medium truncate">
              {metricasSumarizadas.profAtivos} disponíveis
            </div>
          </div>

          <div className="bg-white py-2 px-2.5 sm:p-3 rounded-lg border border-slate-200 shadow-2xs">
            <div className="flex items-center gap-1.5 text-slate-500 text-xs font-medium truncate">
              <Calendar className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              <span>Escalas do Mês (Set/26)</span>
            </div>
            <div className="text-lg sm:text-xl font-bold text-slate-800 mt-0.5 sm:mt-1">
              {metricasSumarizadas.totalEscalasMes}
            </div>
            <div className="text-2xs sm:text-xs text-slate-500 truncate">
              {metricasSumarizadas.concluidas} alocadas • {metricasSumarizadas.curingas} curingas
            </div>
          </div>

          <div className="bg-white py-2 px-2.5 sm:p-3 rounded-lg border border-slate-200 shadow-2xs">
            <div className="flex items-center gap-1.5 text-slate-500 text-xs font-medium truncate">
              <AlertTriangle className={`w-3.5 h-3.5 shrink-0 ${metricasSumarizadas.vagas > 0 ? 'text-amber-500' : 'text-slate-400'}`} />
              <span>Vagas em Aberto</span>
            </div>
            <div className={`text-lg sm:text-xl font-bold mt-0.5 sm:mt-1 ${metricasSumarizadas.vagas > 0 ? 'text-amber-600' : 'text-slate-700'}`}>
              {metricasSumarizadas.vagas}
            </div>
            <div className="text-2xs sm:text-xs text-slate-500 truncate">
              {metricasSumarizadas.vagas > 0 ? `${metricasSumarizadas.vagas} sem profissional` : '100% preenchidas'}
            </div>
          </div>
        </div>

        {/* Menu Dropdown de Consultas Rápidas Categorizadas */}
        <div className="mt-3 sm:mt-4 flex items-center justify-between">
          <div className="relative inline-block text-left" ref={dropdownRef}>
            <button
              type="button"
              disabled={loading}
              onClick={() => setDropdownAberto(prev => !prev)}
              aria-expanded={dropdownAberto}
              aria-haspopup="true"
              className={`inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all shadow-2xs ${
                dropdownAberto
                  ? 'bg-blue-50 text-blue-700 border-blue-300 ring-2 ring-blue-100'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-slate-300'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
              title="Abrir menu de consultas prontas e diagnósticos rápidos"
            >
              <Sparkles className="w-3.5 h-3.5 text-blue-600" />
              <span>Consultas Rápidas</span>
              <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${dropdownAberto ? 'rotate-180 text-blue-600' : ''}`} />
            </button>

            {dropdownAberto && (
              <div 
                className="absolute left-0 mt-1.5 w-80 sm:w-96 rounded-xl bg-white shadow-xl border border-slate-200 py-2 z-50 focus:outline-none animate-in fade-in slide-in-from-top-1 duration-150"
                role="menu"
              >
                <div className="px-3.5 py-1.5 border-b border-slate-100 flex items-center justify-between">
                  <span className="text-2xs font-bold uppercase tracking-wider text-slate-500">
                    Selecione uma Consulta Pronta
                  </span>
                  <span className="text-2xs text-slate-400">
                    Clique para executar
                  </span>
                </div>

                <div className="max-h-[360px] overflow-y-auto divide-y divide-slate-100">
                  {CATEGORIAS_CONSULTAS_RAPIDAS.map((cat, idx) => {
                    const IconeCat = cat.icone;
                    return (
                      <div key={idx} className="p-1.5">
                        <div className="px-2 py-1 text-2xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                          <IconeCat className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                          <span>{cat.categoria}</span>
                        </div>
                        <div className="mt-0.5 space-y-0.5">
                          {cat.itens.map((item, itemIdx) => (
                            <button
                              key={itemIdx}
                              type="button"
                              onClick={() => handleSelecionarConsultaRapida(item.pergunta)}
                              disabled={loading}
                              className="w-full text-left px-2.5 py-2 text-xs rounded-lg hover:bg-blue-50/80 group transition-colors flex flex-col gap-0.5 disabled:opacity-50"
                              role="menuitem"
                            >
                              <div className="flex items-center justify-between font-semibold text-slate-700 group-hover:text-blue-700">
                                <span>{item.rotulo}</span>
                                <span className="text-2xs font-normal text-slate-400 group-hover:text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity">
                                  Executar ↵
                                </span>
                              </div>
                              <span className="text-2xs text-slate-500 group-hover:text-blue-600/80 line-clamp-1">
                                {item.descricao}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="text-2xs text-slate-400 hidden sm:block">
            Selecione uma consulta ou pergunte livremente abaixo
          </div>
        </div>
      </div>

      {/* Alerta de Erro */}
      {erro && (
        <div className="m-3.5 sm:m-6 p-3.5 sm:p-4 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="text-sm font-semibold text-rose-900">Falha ao processar a consulta</h4>
            <p className="text-xs text-rose-700 mt-1">{erro}</p>
            <button
              type="button"
              onClick={() => handleConsultar()}
              className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-700 bg-rose-100 hover:bg-rose-200 rounded-md transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Tentar Novamente
            </button>
          </div>
        </div>
      )}

      {/* Área de Conversa / Histórico */}
      <div className="p-3.5 sm:p-6 space-y-4 sm:space-y-6 min-h-[160px] max-h-[600px] overflow-y-auto">
        {mensagens.length === 0 && !loading && (
          <div className="py-8 text-center bg-white rounded-lg border border-dashed border-slate-200 p-6">
            <div className="inline-flex items-center justify-center p-3 bg-blue-50 text-blue-600 rounded-full mb-2.5">
              <MessageSquare className="w-5 h-5" />
            </div>
            <h4 className="text-sm font-semibold text-slate-800">
              Pronto para responder suas dúvidas operacionais
            </h4>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
              Digite uma pergunta livre no campo abaixo ou utilize os botões de atalhos rápidos para obter diagnósticos instantâneos.
            </p>
          </div>
        )}

        {mensagens.map((msg) => (
          <div 
            key={msg.id} 
            className={`flex flex-col ${msg.tipo === 'pergunta' ? 'items-end' : 'items-start'}`}
          >
            {msg.tipo === 'pergunta' ? (
              <div className="max-w-[90%] sm:max-w-[85%] bg-blue-600 text-white rounded-2xl rounded-tr-xs px-3.5 sm:px-4 py-2.5 sm:py-3 shadow-xs">
                <div className="text-xs text-blue-100 font-medium mb-1 flex items-center gap-1">
                  <span>Você (Administrador)</span>
                  <span>•</span>
                  <span>{new Date(msg.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <div className="text-sm font-medium leading-relaxed whitespace-pre-wrap">
                  {msg.texto}
                </div>
              </div>
            ) : (
              <div className="w-full max-w-full sm:max-w-[95%] bg-slate-50 border border-slate-200 rounded-2xl rounded-tl-xs p-3.5 sm:p-5 shadow-xs">
                <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-200">
                  <div className="flex items-center gap-2">
                    <div className="p-1 bg-blue-600 text-white rounded-md">
                      <Bot className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-bold text-slate-700">Resposta da Inteligência Operacional</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-2xs text-slate-400">
                      {new Date(msg.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopiar(msg.id, msg.texto)}
                      className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-slate-200/60 rounded-md transition-colors"
                      title="Copiar resposta"
                    >
                      {copiadoId === msg.id ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div className="prose max-w-none text-slate-700 text-sm leading-relaxed">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      table: ({ children }) => (
                        <div className="overflow-x-auto my-4 rounded-xl border border-slate-200 shadow-2xs bg-white">
                          <table className="min-w-full divide-y divide-slate-200 text-left text-xs text-slate-700">
                            {children}
                          </table>
                        </div>
                      ),
                      thead: ({ children }) => (
                        <thead className="bg-slate-100/95 text-slate-800 font-bold uppercase text-[11px] tracking-wider border-b border-slate-200">
                          {children}
                        </thead>
                      ),
                      tbody: ({ children }) => (
                        <tbody className="divide-y divide-slate-100 bg-white">
                          {children}
                        </tbody>
                      ),
                      tr: ({ children }) => (
                        <tr className="hover:bg-blue-50/50 transition-colors odd:bg-white even:bg-slate-50/70">
                          {children}
                        </tr>
                      ),
                      th: ({ children }) => (
                        <th scope="col" className="px-3.5 py-2.5 font-bold text-slate-700 border-r last:border-r-0 border-slate-200 whitespace-nowrap">
                          {children}
                        </th>
                      ),
                      td: ({ children }) => (
                        <td className="px-3.5 py-2 text-slate-600 border-r last:border-r-0 border-slate-100 whitespace-nowrap">
                          {children}
                        </td>
                      ),
                      h1: ({ children }) => (
                        <h1 className="text-xl font-bold text-slate-900 border-b border-slate-200 pb-2 mb-4 mt-2">
                          {children}
                        </h1>
                      ),
                      h2: ({ children }) => (
                        <h2 className="text-base font-bold text-blue-900 bg-blue-50 px-3 py-1.5 rounded-lg border-l-4 border-blue-600 mt-6 mb-3">
                          {children}
                        </h2>
                      ),
                      h3: ({ children }) => (
                        <h3 className="text-sm font-semibold text-slate-800 mt-4 mb-2">
                          {children}
                        </h3>
                      ),
                      p: ({ children }) => (
                        <p className="mb-2.5 leading-relaxed text-slate-700">
                          {children}
                        </p>
                      ),
                      ul: ({ children }) => (
                        <ul className="list-disc list-outside pl-5 mb-3 space-y-1 text-slate-700">
                          {children}
                        </ul>
                      ),
                      ol: ({ children }) => (
                        <ol className="list-decimal list-outside pl-5 mb-3 space-y-1 text-slate-700">
                          {children}
                        </ol>
                      ),
                      li: ({ children }) => (
                        <li className="pl-1">
                          {children}
                        </li>
                      ),
                      strong: ({ children }) => (
                        <strong className="font-semibold text-slate-900">
                          {children}
                        </strong>
                      ),
                      blockquote: ({ children }) => (
                        <blockquote className="border-l-4 border-slate-300 pl-3 py-1 italic bg-white text-slate-600 rounded-r my-3">
                          {children}
                        </blockquote>
                      ),
                    }}
                  >
                    {normalizarMarkdownTabelas(msg.texto)}
                  </ReactMarkdown>
                </div>
              </div>
            )}
          </div>
        ))}

        {/* Indicador de Carregamento em Tempo Real */}
        {loading && (
          <div className="flex items-start gap-3 w-full max-w-[95%] bg-blue-50/60 border border-blue-100 rounded-2xl rounded-tl-xs p-4 shadow-xs animate-pulse">
            <div className="p-2 bg-blue-600 text-white rounded-lg shrink-0">
              <RefreshCw className="w-4 h-4 animate-spin" />
            </div>
            <div>
              <div className="text-xs font-bold text-blue-900">
                Consultando dados operacionais...
              </div>
              <p className="text-xs text-blue-700 mt-0.5">
                {loadingStep || 'Processando consulta e elaborando parecer analítico...'}
              </p>
            </div>
          </div>
        )}

        <div ref={mensagensEndRef} />
      </div>

      {/* Barra de Entrada de Mensagens / Perguntas */}
      <div className="p-3 sm:p-4 bg-slate-50 border-t border-slate-200">
        <div className="flex items-end gap-2">
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              rows={2}
              value={perguntaInput}
              onChange={(e) => setPerguntaInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={loading}
              placeholder="Digite sua pergunta operacional (ex.: Quais profissionais estão sem escalas? Identifique gargalos e riscos de sobrecarga...)"
              className="w-full text-sm p-3 sm:pb-6 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white resize-none shadow-2xs placeholder:text-slate-400 disabled:bg-slate-100 disabled:cursor-not-allowed leading-relaxed"
            />
            <div className="hidden sm:block absolute bottom-2 right-3 text-2xs text-slate-400 pointer-events-none select-none">
              Pressione Enter para enviar
            </div>
          </div>

          <button
            type="button"
            disabled={loading || !perguntaInput.trim()}
            onClick={() => handleConsultar()}
            className="inline-flex items-center justify-center gap-1.5 px-3.5 sm:px-4 py-3 bg-blue-600 hover:bg-blue-700 active:scale-95 disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl shadow-xs transition-all h-[54px] shrink-0"
            title="Enviar pergunta"
          >
            {loading ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Send className="w-4 h-4" />
                <span className="hidden sm:inline">Consultar</span>
              </>
            )}
          </button>
        </div>

        <div className="mt-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5 text-[11px] text-gray-500">
          <div className="flex items-center gap-1.5 leading-tight">
            <Lock className="w-3 h-3 text-gray-400 shrink-0" />
            <span>Privacy by Design: Dados pessoais substituídos por pseudônimos no envio e restaurados localmente no seu navegador.</span>
          </div>
          {mensagens.length > 0 && (
            <button
              type="button"
              onClick={handleLimparConversa}
              className="text-gray-500 hover:text-gray-700 underline cursor-pointer shrink-0 self-start sm:self-auto font-medium"
            >
              Iniciar nova consulta
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
