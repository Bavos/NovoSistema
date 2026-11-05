import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import React, { useState, useMemo } from 'react';
import { useFirebase } from '../context/FirebaseContext';
import { Printer, ChevronDown, ChevronRight, HelpCircle, X } from 'lucide-react';

interface RelatorioItem {
  id: string;
  titulo: string;
  descricao: string;
  ajuda: string;
}

interface GrupoRelatorio {
  id: string;
  nome: string;
  itens: RelatorioItem[];
}

const GRUPOS_INICIAIS: GrupoRelatorio[] = [
  {
    id: 'info_gerais',
    nome: 'Informações Gerais',
    itens: [
      {
        id: 'log_agendamentos',
        titulo: 'Log de Agendamentos por Usuários Administrativos',
        descricao: 'Rastreabilidade e auditoria dos agendamentos criados no período, exibindo o usuário administrativo responsável pelo cadastro.',
        ajuda: 'Exibe os registros de plantões agrupados por profissional informando quem cadastrou cada agendamento no sistema.'
      },
      {
        id: 'previa_curingas',
        titulo: 'Prévia Financeira de Curingas',
        descricao: 'Relatório detalhado das coberturas e plantões avulsos realizados por profissionais curingas com discriminação de valores e taxas.',
        ajuda: 'Exibe os plantões de cobertura/curinga realizados por paciente com valores de produção e taxa administrativa.'
      },
      {
        id: 'previa_folha',
        titulo: 'Prévia Financeira da Folha de Pagamento',
        descricao: 'Demonstrativo prévio da folha de pagamento por profissional, exibindo quantidade de plantões, produção, adicionais e valor bruto.',
        ajuda: 'Exibe a consolidação financeira dos profissionais para fechamento da folha no período.'
      },
      {
        id: 'previa_folha_bancos',
        titulo: 'Prévia Financeira da Folha de Pagamento Por Bancos',
        descricao: 'Demonstrativo financeiro da folha de pagamento agrupado por instituição bancária, detalhando produção, ajuda de custo, valor bruto e dados de pagamento.',
        ajuda: 'Exibe a folha de pagamento dividida por cada banco com subtotais financeiros e dados bancários de cada profissional.'
      },
      {
        id: 'faltas_profissional',
        titulo: 'Relação de Faltas por Profissional',
        descricao: 'Lista detalhada das faltas e ausências registradas no período, agrupadas por profissional com motivos e observações.',
        ajuda: 'Exibe ausências, faltas justificadas ou não justificadas por profissional no período selecionado.'
      },
      {
        id: 'atend_paciente',
        titulo: 'Relação de Atendimentos por Paciente',
        descricao: 'Lista detalhada dos atendimentos realizados no período, agrupando por paciente. Mostra data, profissional, duração e valores.',
        ajuda: 'Exibe todos os plantões do período agrupados por paciente com detalhamento de datas, horários, profissionais e valores.'
      },
      {
        id: 'atend_profissional',
        titulo: 'Relação de Atendimentos por Profissional',
        descricao: 'Lista detalhada dos atendimentos realizados no período, agrupando por profissional. Mostra paciente, data, duração e valores.',
        ajuda: 'Exibe todos os plantões realizados agrupados por profissional com detalhamento de paciente, data e valores de repasse.'
      },
      {
        id: 'bancos_profissional',
        titulo: 'Relação de Bancos por Profissional',
        descricao: 'Lista e conferência de dados bancários, agências, contas e chaves PIX cadastradas por profissional.',
        ajuda: 'Exibe os dados bancários dos profissionais cadastrados no sistema para conferência e folha de pagamento.'
      }
    ]
  }
];

export const Relatorios: React.FC = () => {
  const { pacientes, profissionais, agendamentos, plantoes } = useFirebase();

  const hoje = new Date();
  const primeiroDiaMes = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-01`;
  const ultimoDiaNum = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate();
  const ultimoDiaMes = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(ultimoDiaNum).padStart(2, '0')}`;

  const [dataInicial, setDataInicial] = useState<string>(primeiroDiaMes);
  const [dataFinal, setDataFinal] = useState<string>(ultimoDiaMes);
  const [pacienteId, setPacienteId] = useState<string>('');
  const [profissionalId, setProfissionalId] = useState<string>('');
  const [gruposExpandidos, setGruposExpandidos] = useState<Record<string, boolean>>({
    info_gerais: true,
  });

  const [modalRelatorioAtivo, setModalRelatorioAtivo] = useState<string | null>(null);

  const pacientesOrdenados = useMemo(() => {
    return [...(pacientes || [])].sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
  }, [pacientes]);

  const profissionaisOrdenados = useMemo(() => {
    return [...(profissionais || [])].sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
  }, [profissionais]);

  const expandirTodos = () => {
    const novo: Record<string, boolean> = {};
    GRUPOS_INICIAIS.forEach(g => { novo[g.id] = true; });
    setGruposExpandidos(novo);
  };

  const recolherTodos = () => {
    const novo: Record<string, boolean> = {};
    GRUPOS_INICIAIS.forEach(g => { novo[g.id] = false; });
    setGruposExpandidos(novo);
  };

  const limparFiltros = () => {
    setDataInicial(primeiroDiaMes);
    setDataFinal(ultimoDiaMes);
    setPacienteId('');
    setProfissionalId('');
  };

  const toggleGrupo = (id: string) => {
    setGruposExpandidos(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleAbrirRelatorio = (item: RelatorioItem) => {
    setModalRelatorioAtivo(item.id);
  };

  const formatarDataBr = (dataIso: string) => {
    if (!dataIso) return '';
    const partes = dataIso.slice(0, 10).split('-');
    if (partes.length === 3) return `${partes[2]}/${partes[1]}/${partes[0]}`;
    return dataIso;
  };

  const formatarMoeda = (valor: number | undefined | null) => {
    const num = Number(valor || 0);
    return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const dadosRelatorioPaciente = useMemo(() => {
    if (modalRelatorioAtivo !== 'atend_paciente') return [];
    const listaCompleta: any[] = [];
    if (agendamentos) {
      agendamentos.forEach(ag => {
        listaCompleta.push({
          id: ag.id,
          pacienteId: ag.idPaciente,
          profissionalId: ag.idProfissional,
          profissionalNome: ag.nomeProfissional,
          data: ag.data,
          horario: ag.horario || '07:00',
          status: ag.status || 'Agendado',
          observacao: ag.observacao || '',
          tipoEscala: ag.tipoDia || 'Plantão 12x36'
        });
      });
    }
    if (plantoes) {
      plantoes.forEach(pl => {
        listaCompleta.push({
          id: pl.id,
          pacienteId: pl.pacienteId,
          profissionalId: pl.profissional || '',
          profissionalNome: pl.profissional || 'Não Informado',
          data: pl.data,
          horario: pl.horaInicio || '07:00',
          status: pl.status || 'Agendado',
          observacao: pl.observacaoAgendamento || '',
          tipoEscala: pl.tipoEscala ? `Escala ${pl.tipoEscala}` : 'Plantão'
        });
      });
    }

    const filtrados = listaCompleta.filter(item => {
      if (!item.data || typeof item.data !== 'string' || item.data.trim() === '') return false;
      if (!item.pacienteId || item.pacienteId === 'desconhecido') return false;
      const pacExiste = (pacientes || []).some(p => p.id === item.pacienteId);
      if (!pacExiste) return false;

      const dataItem = item.data.slice(0, 10);
      if (dataInicial && dataItem < dataInicial) return false;
      if (dataFinal && dataItem > dataFinal) return false;
      if (pacienteId && item.pacienteId !== pacienteId) return false;
      if (profissionalId && item.profissionalId !== profissionalId) return false;
      if (item.status === 'Cancelado') return false;
      return true;
    });

    const agrupadoMap: Record<string, { paciente: any; itens: any[] }> = {};
    filtrados.forEach(item => {
      const pac = (pacientes || []).find(p => p.id === item.pacienteId);
      const pId = item.pacienteId || 'desconhecido';
      if (!agrupadoMap[pId]) {
        agrupadoMap[pId] = {
          paciente: pac || { nome: 'Paciente Desconhecido', nomeResponsavel: 'Padrão' },
          itens: []
        };
      }
      agrupadoMap[pId].itens.push(item);
    });

    return Object.values(agrupadoMap).sort((a, b) => (a.paciente.nome || '').localeCompare(b.paciente.nome || ''));
  }, [modalRelatorioAtivo, agendamentos, plantoes, dataInicial, dataFinal, pacienteId, profissionalId, pacientes]);

  const dadosRelatorioProfissional = useMemo(() => {
    if (modalRelatorioAtivo !== 'atend_profissional') return [];
    const listaCompleta: any[] = [];
    if (agendamentos) {
      agendamentos.forEach(ag => {
        listaCompleta.push({
          id: ag.id,
          pacienteId: ag.idPaciente,
          profissionalId: ag.idProfissional,
          profissionalNome: ag.nomeProfissional,
          data: ag.data,
          horario: ag.horario || '07:00',
          status: ag.status || 'Agendado',
          observacao: ag.observacao || '',
          tipoEscala: ag.tipoDia || 'Plantão 12x36'
        });
      });
    }
    if (plantoes) {
      plantoes.forEach(pl => {
        listaCompleta.push({
          id: pl.id,
          pacienteId: pl.pacienteId,
          profissionalId: pl.profissional || '',
          profissionalNome: pl.profissional || 'Não Informado',
          data: pl.data,
          horario: pl.horaInicio || '07:00',
          status: pl.status || 'Agendado',
          observacao: pl.observacaoAgendamento || '',
          tipoEscala: pl.tipoEscala ? `Escala ${pl.tipoEscala}` : 'Plantão'
        });
      });
    }

    const filtrados = listaCompleta.filter(item => {
      if (!item.data) return false;
      const dataItem = item.data.slice(0, 10);
      if (dataInicial && dataItem < dataInicial) return false;
      if (dataFinal && dataItem > dataFinal) return false;
      if (pacienteId && item.pacienteId !== pacienteId) return false;
      if (profissionalId && item.profissionalId !== profissionalId) return false;
      if (item.status === 'Cancelado') return false;
      return true;
    });

    const agrupadoMap: Record<string, { profissional: any; itens: any[] }> = {};
    filtrados.forEach(item => {
      const prof = (profissionais || []).find(p => p.id === item.profissionalId || p.nome === item.profissionalNome);
      const pKey = prof?.id || item.profissionalId || item.profissionalNome || 'desconhecido';
      if (!agrupadoMap[pKey]) {
        agrupadoMap[pKey] = {
          profissional: prof || { nome: item.profissionalNome || 'Profissional Desconhecido', especialidade: 'Cuidador(a)', conselho: '' },
          itens: []
        };
      }
      agrupadoMap[pKey].itens.push(item);
    });

    return Object.values(agrupadoMap).sort((a, b) => (a.profissional.nome || '').localeCompare(b.profissional.nome || ''));
  }, [modalRelatorioAtivo, agendamentos, plantoes, dataInicial, dataFinal, pacienteId, profissionalId, profissionais]);

  // Dados do Relatório de Relação de Bancos por Profissional
  const dadosRelatorioBancos = useMemo(() => {
    if (modalRelatorioAtivo !== 'bancos_profissional') return [];

    let lista = [...(profissionais || [])];
    if (profissionalId) {
      lista = lista.filter(p => p.id === profissionalId);
    }

    // Filtra profissionais válidos que possuem ao menos o nome preenchido
    lista = lista.filter(p => p && p.nome && typeof p.nome === 'string' && p.nome.trim() !== '');

    const mapaBancos: Record<string, { bancoNome: string; itens: any[] }> = {};

    lista.forEach((prof: any) => {
      const db: any = prof.dadosBancarios || {};
      const bancoRaw = db.banco || prof.banco || '';
      const nomeBanco = bancoRaw.trim() ? bancoRaw.trim() : 'Outros / Sem Banco Cadastrado';

      if (!mapaBancos[nomeBanco]) {
        mapaBancos[nomeBanco] = {
          bancoNome: nomeBanco,
          itens: []
        };
      }

      mapaBancos[nomeBanco].itens.push({
        id: prof.id,
        nome: prof.nome,
        especialidade: prof.especialidade || prof.profissao || 'Cuidador(a)',
        cpf: prof.cpf || prof.cnpj || '-',
        telefone: prof.telefone || '-',
        banco: nomeBanco,
        agencia: db.agencia || prof.agencia || '-',
        conta: db.conta || prof.conta || '-',
        tipoConta: db.tipoConta || prof.tipoConta || 'Corrente',
        pix: db.pix || prof.pix || prof.chavePix || '-',
        isTitular: prof.isTitularConta !== false && prof.isTitularConta !== 'nao',
        nomeTitular: prof.nomeTitularConta || prof.nome || '',
        cpfTitular: prof.cpfTitularConta || prof.cpf || ''
      });
    });

    // Ordena profissionais por nome dentro de cada banco
    Object.values(mapaBancos).forEach(g => {
      g.itens.sort((a, b) => a.nome.localeCompare(b.nome));
    });

    // Ordena bancos em ordem alfabética (mantendo "Outros / Sem Banco" no final)
    return Object.values(mapaBancos).sort((a, b) => {
      if (a.bancoNome.includes('Sem Banco')) return 1;
      if (b.bancoNome.includes('Sem Banco')) return -1;
      return a.bancoNome.localeCompare(b.bancoNome);
    });
  }, [modalRelatorioAtivo, profissionais, profissionalId]);

  // Dados do Relatório de Faltas por Profissional
  const dadosRelatorioFaltas = useMemo(() => {
    if (modalRelatorioAtivo !== 'faltas_profissional') return [];
    const listaCompleta: any[] = [];
    const pacMap = new Map((pacientes || []).map(p => [p.id, p]));

    const obterNomePaciente = (item: any, idPac: string) => {
      if (item.nomePaciente) return item.nomePaciente;
      if (item.paciente && typeof item.paciente === 'string' && item.paciente.length > 3) return item.paciente;
      const pac = pacMap.get(idPac);
      return pac?.nome || '';
    };

    const processarItem = (item: any, idPac: string, idProf: string, nomeProf: string, hr: string, motivoRaw: string, obsRaw: string, escala: string) => {
      if (!item.data) return;
      const nomePaciente = obterNomePaciente(item, idPac);
      if (!nomePaciente) return;

      const st = (item.status || '').toLowerCase();
      const motivoValido = motivoRaw && motivoRaw !== '-' && motivoRaw.trim() !== '';
      const obsValida = obsRaw && obsRaw !== '-' && obsRaw.trim() !== '';

      const ehFaltaReal = st.includes('falta') || Boolean(motivoValido);
      if (!ehFaltaReal) return;

      listaCompleta.push({
        id: item.id,
        pacienteId: idPac,
        pacienteNome: nomePaciente,
        profissionalId: idProf,
        profissionalNome: nomeProf || 'Não Informado',
        data: item.data,
        horario: hr || '07:00',
        status: item.status || 'Agendado',
        motivo: motivoRaw || (st.includes('falta') ? 'Falta' : '-'),
        observacao: obsValida ? obsRaw : '-',
        tipoEscala: escala || 'Plantão'
      });
    };

    if (agendamentos) {
      agendamentos.forEach((ag: any) => {
        processarItem(
          ag,
          ag.idPaciente || ag.pacienteId,
          ag.idProfissional || ag.profissionalId,
          ag.nomeProfissional,
          ag.horario || '07:00',
          ag.motivoFalta || ag.justificativaFalta || ag.motivo,
          ag.observacao || ag.observacaoFalta,
          ag.tipoDia || 'Plantão 12x36'
        );
      });
    }

    if (plantoes) {
      plantoes.forEach((pl: any) => {
        processarItem(
          pl,
          pl.pacienteId || pl.idPaciente,
          pl.profissionalId || pl.profissional,
          pl.profissional,
          pl.horaInicio || '07:00',
          pl.motivoFalta || pl.justificativaFalta || pl.motivo,
          pl.observacaoAgendamento || pl.observacao,
          pl.tipoEscala ? `Escala ${pl.tipoEscala}` : 'Plantão'
        );
      });
    }

    const filtrados = listaCompleta.filter(item => {
      const dataItem = item.data.slice(0, 10);
      if (dataInicial && dataItem < dataInicial) return false;
      if (dataFinal && dataItem > dataFinal) return false;
      if (pacienteId && item.pacienteId !== pacienteId) return false;
      if (profissionalId && item.profissionalId !== profissionalId) return false;
      return true;
    });

    const agrupadoMap: Record<string, { profissional: any; itens: any[] }> = {};
    filtrados.forEach(item => {
      const prof = (profissionais || []).find(p => p.id === item.profissionalId || p.nome === item.profissionalNome);
      const pKey = prof?.id || item.profissionalId || item.profissionalNome || 'desconhecido';
      if (!agrupadoMap[pKey]) {
        agrupadoMap[pKey] = {
          profissional: prof || { nome: item.profissionalNome, especialidade: 'Cuidador(a)', conselho: '' },
          itens: []
        };
      }
      agrupadoMap[pKey].itens.push(item);
    });

    return Object.values(agrupadoMap).sort((a, b) => (a.profissional.nome || '').localeCompare(b.profissional.nome || ''));
  }, [modalRelatorioAtivo, agendamentos, plantoes, dataInicial, dataFinal, pacienteId, profissionalId, profissionais, pacientes]);

  // Dados da Prévia Financeira da Folha de Pagamento
  const dadosPreviaFolha = useMemo(() => {
    if (modalRelatorioAtivo !== 'previa_folha') return [];
    const profMap: Record<string, any> = {};

    (profissionais || []).forEach(p => {
      profMap[p.id] = {
        id: p.id,
        nome: p.nome || 'Não informado',
        tipo: 'Plantonista',
        qtd: 0,
        salario: 0,
        producao: 0,
        ajudaCusto: 0,
        bruto: 0
      };
    });

    const lista = [...(agendamentos || []), ...(plantoes || [])];
    lista.forEach((item: any) => {
      const dataItem = (item.data || '').slice(0, 10);
      if (dataInicial && dataItem < dataInicial) return;
      if (dataFinal && dataItem > dataFinal) return;
      if (item.status === 'Cancelado' || item.status?.toLowerCase().includes('falta')) return;

      const pId = item.idProfissional || item.profissionalId || item.profissional;
      const pNome = item.nomeProfissional || item.profissional || 'Outro';

      let ref = profMap[pId];
      if (!ref) {
        const encontrado = Object.values(profMap).find((p: any) => p.nome === pNome);
        if (encontrado) ref = encontrado;
      }

      const valorPlantao = Number(item.valorProfissional || item.valor || item.valorRepasse || 175.00);
      const ajuda = Number(item.ajudaCusto || 0);

      if (ref) {
        ref.qtd += 1;
        ref.producao += valorPlantao;
        ref.ajudaCusto += ajuda;
        ref.bruto += (valorPlantao + ajuda);
      }
    });

    return Object.values(profMap).filter((p: any) => p.qtd > 0).sort((a: any, b: any) => a.nome.localeCompare(b.nome));
  }, [modalRelatorioAtivo, profissionais, agendamentos, plantoes, dataInicial, dataFinal]);

  // Dados da Prévia Financeira da Folha de Pagamento Por Bancos
  const dadosPreviaFolhaPorBancos = useMemo(() => {
    if (modalRelatorioAtivo !== 'previa_folha_bancos') return [];
    const profMap: Record<string, any> = {};

    (profissionais || []).forEach((p: any) => {
      const db: any = p.dadosBancarios || {};
      const bancoRaw = (db.banco || p.banco || '').trim();
      const nomeBanco = bancoRaw ? bancoRaw : 'Outros / Sem Banco Cadastrado';

      profMap[p.id] = {
        id: p.id,
        nome: p.nome || 'Não informado',
        cpf: p.cpf || p.cnpj || '-',
        banco: nomeBanco,
        agencia: db.agencia || p.agencia || '-',
        conta: db.conta || p.conta || '-',
        tipoConta: db.tipoConta || p.tipoConta || 'Corrente',
        pix: db.pix || p.pix || p.chavePix || '-',
        tipo: 'Plantonista',
        qtd: 0,
        salario: 0,
        producao: 0,
        ajudaCusto: 0,
        bruto: 0
      };
    });

    const lista = [...(agendamentos || []), ...(plantoes || [])];
    lista.forEach((item: any) => {
      const dataItem = (item.data || '').slice(0, 10);
      if (dataInicial && dataItem < dataInicial) return;
      if (dataFinal && dataItem > dataFinal) return;
      if (item.status === 'Cancelado' || item.status?.toLowerCase().includes('falta')) return;

      const pId = item.idProfissional || item.profissionalId || item.profissional;
      const pNome = item.nomeProfissional || item.profissional || 'Outro';

      let ref = profMap[pId];
      if (!ref) {
        const encontrado = Object.values(profMap).find((p: any) => p.nome === pNome);
        if (encontrado) ref = encontrado;
      }

      const valorPlantao = Number(item.valorProfissional || item.valor || item.valorRepasse || 175.00);
      const ajuda = Number(item.ajudaCusto || 0);

      if (ref) {
        ref.qtd += 1;
        ref.producao += valorPlantao;
        ref.ajudaCusto += ajuda;
        ref.bruto += (valorPlantao + ajuda);
      }
    });

    // Filtra apenas profissionais com produção > 0
    const profissionaisComProducao = Object.values(profMap).filter((p: any) => p.qtd > 0);

    // Agrupa por banco
    const mapaBancos: Record<string, { bancoNome: string; itens: any[]; totalQtd: number; totalBruto: number; totalProducao: number; totalAjuda: number }> = {};

    profissionaisComProducao.forEach((p: any) => {
      if (!mapaBancos[p.banco]) {
        mapaBancos[p.banco] = {
          bancoNome: p.banco,
          itens: [],
          totalQtd: 0,
          totalBruto: 0,
          totalProducao: 0,
          totalAjuda: 0
        };
      }
      mapaBancos[p.banco].itens.push(p);
      mapaBancos[p.banco].totalQtd += p.qtd;
      mapaBancos[p.banco].totalProducao += p.producao;
      mapaBancos[p.banco].totalAjuda += p.ajudaCusto;
      mapaBancos[p.banco].totalBruto += p.bruto;
    });

    // Ordena profissionais por nome dentro de cada banco
    Object.values(mapaBancos).forEach(g => {
      g.itens.sort((a, b) => a.nome.localeCompare(b.nome));
    });

    // Ordena bancos alfabeticamente
    return Object.values(mapaBancos).sort((a, b) => {
      if (a.bancoNome.includes('Sem Banco')) return 1;
      if (b.bancoNome.includes('Sem Banco')) return -1;
      return a.bancoNome.localeCompare(b.bancoNome);
    });
  }, [modalRelatorioAtivo, profissionais, agendamentos, plantoes, dataInicial, dataFinal]);

  // Dados da Prévia Financeira de Curingas
  const dadosPreviaCuringas = useMemo(() => {
    if (modalRelatorioAtivo !== 'previa_curingas') return [];
    const listaCompleta: any[] = [];

    const lista = [...(agendamentos || []), ...(plantoes || [])];
    lista.forEach((item: any) => {
      const dataItem = (item.data || '').slice(0, 10);
      if (dataInicial && dataItem < dataInicial) return;
      if (dataFinal && dataItem > dataFinal) return;
      if (item.status === 'Cancelado') return;

      const textoCompleto = `${item.tipoEscala || ''} ${item.tipoDia || ''} ${item.observacao || ''} ${item.observacaoAgendamento || ''} ${item.tipo || ''} ${item.modalidade || ''} ${item.evento || ''}`.toLowerCase();
      
      const isCuringa = Boolean(
        item.curinga === true || 
        item.isCuringa === true || 
        item.plantaoCuringa === true ||
        textoCompleto.includes('curinga') ||
        textoCompleto.includes('cobertura avulsa')
      );

      if (isCuringa) {
        const prod = Number(item.valorProfissional || item.valor || 175.00);
        const txAdm = Number(item.taxaAdministrativa || (prod * 0.25) || 45.00);
        listaCompleta.push({
          id: item.id,
          pacienteId: item.idPaciente || item.pacienteId,
          profissionalId: item.idProfissional || item.profissionalId || item.profissional,
          profissionalNome: item.nomeProfissional || item.profissional || 'Profissional',
          data: item.data,
          horario: item.horario || item.horaInicio || '08:00',
          evento: item.tipoDia || (item.tipoEscala ? `Plantão ${item.tipoEscala}` : 'Plantão 24 x 48'),
          producao: prod,
          vHora: Number((prod / 24).toFixed(2)),
          txAdm: txAdm
        });
      }
    });

    const pacMap = new Map((pacientes || []).map(p => [p.id, p]));
    const agrupado: Record<string, any> = {};

    listaCompleta.forEach(it => {
      if (!agrupado[it.profissionalNome]) {
        agrupado[it.profissionalNome] = {
          nome: it.profissionalNome,
          itens: [],
          totalProducao: 0,
          totalTxAdm: 0
        };
      }
      const pac = pacMap.get(it.pacienteId);
      agrupado[it.profissionalNome].itens.push({
        ...it,
        pacienteNome: pac?.nome || it.pacienteId || 'Paciente Não Informado'
      });
      agrupado[it.profissionalNome].totalProducao += it.producao;
      agrupado[it.profissionalNome].totalTxAdm += it.txAdm;
    });

    return Object.values(agrupado).sort((a: any, b: any) => a.nome.localeCompare(b.nome));
  }, [modalRelatorioAtivo, agendamentos, plantoes, pacientes, dataInicial, dataFinal]);

  // Dados do Relatório de Log de Agendamentos por Usuários Administrativos
  const dadosRelatorioLog = useMemo(() => {
    if (modalRelatorioAtivo !== 'log_agendamentos') return [];
    const listaCompleta: any[] = [];
    const lista = [...(agendamentos || []), ...(plantoes || [])];
    const pacMap = new Map((pacientes || []).map(p => [p.id, p]));

    lista.forEach((item: any) => {
      if (!item.data) return;
      const dataItem = (item.data || '').slice(0, 10);
      if (dataInicial && dataItem < dataInicial) return;
      if (dataFinal && dataItem > dataFinal) return;
      if (pacienteId && (item.idPaciente !== pacienteId && item.pacienteId !== pacienteId)) return;
      if (profissionalId && (item.idProfissional !== profissionalId && item.profissionalId !== profissionalId)) return;
      if (item.status === 'Cancelado') return;

      const pId = item.idProfissional || item.profissionalId || item.profissional;
      const prof = (profissionais || []).find(p => p.id === pId || p.nome === item.nomeProfissional || p.nome === item.profissional);
      const pac = pacMap.get(item.idPaciente || item.pacienteId);
      const nomePaciente = item.nomePaciente || (typeof item.paciente === 'string' && item.paciente.length > 3 ? item.paciente : pac?.nome) || 'Paciente Não Informado';

      const criadoPor = item.criadoPor || item.usuarioCriador || item.criadoPorNome || item.criadoPorEmail || 'Renato Basseres Zarvos';

      listaCompleta.push({
        id: item.id,
        profissionalId: pId,
        profissionalNome: prof?.nome || item.nomeProfissional || item.profissional || 'Profissional Desconhecido',
        profissionalEspecialidade: prof?.especialidade || 'Cuidador(a)',
        profissionalConselho: prof?.conselho || '',
        telefone: prof?.telefone || (prof as any)?.whatsapp || '(21) 99127-6240',
        pacienteNome: nomePaciente,
        data: item.data,
        horario: item.horario || item.horaInicio || '08:00',
        criadoPor: criadoPor,
        status: item.status || 'Agendado'
      });
    });

    const agrupado: Record<string, { profissional: any; itens: any[] }> = {};
    listaCompleta.forEach(it => {
      if (!agrupado[it.profissionalNome]) {
        agrupado[it.profissionalNome] = {
          profissional: {
            nome: it.profissionalNome,
            especialidade: it.profissionalEspecialidade,
            conselho: it.profissionalConselho
          },
          itens: []
        };
      }
      agrupado[it.profissionalNome].itens.push(it);
    });

    return Object.values(agrupado).sort((a, b) => a.profissional.nome.localeCompare(b.profissional.nome));
  }, [modalRelatorioAtivo, agendamentos, plantoes, profissionais, pacientes, dataInicial, dataFinal, pacienteId, profissionalId]);

  
      
  const handleBaixarAtendPacientePDF = () => {
    try {
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.setTextColor(24, 61, 51);
      doc.text("VALLIDARE", 14, 15);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(100, 100, 100);
      doc.text("Gestão e Consultoria em Saúde", 14, 19);

      doc.setFontSize(11);
      doc.setTextColor(50, 50, 50);
      doc.text("Relação de Atendimentos por Paciente", 14, 25);

      doc.setFontSize(8);
      doc.setTextColor(110, 110, 110);
      doc.text(`Período: ${formatarDataBr(dataInicial)} a ${formatarDataBr(dataFinal)}   |   Emitido em: ${new Date().toLocaleDateString("pt-BR")}`, 14, 30);

      doc.setDrawColor(210, 210, 210);
      doc.setLineWidth(0.3);
      doc.line(14, 32, 196, 32);

      let startY = 38;

      if (!dadosRelatorioPaciente || dadosRelatorioPaciente.length === 0) {
        doc.setFontSize(9);
        doc.setTextColor(120, 120, 120);
        doc.text("Nenhum atendimento encontrado para o período selecionado.", 14, startY);
      } else {
        dadosRelatorioPaciente.forEach((grupo, idx) => {
          doc.setFont("helvetica", "bold");
          doc.setFontSize(10);
          doc.setTextColor(24, 61, 51);
          const pacNome = grupo.paciente?.nome || "Paciente Não Informado";
          doc.text(`Paciente: ${pacNome}`, 14, startY);
          startY += 4;

          // Agrupa plantões por profissional e conta os dias/plantões
          const contagemPorProf = {};
          (grupo.itens || grupo.atendimentos || []).forEach((item) => {
            const prof = item.profissionalNome || item.profissional || "Não informado";
            contagemPorProf[prof] = (contagemPorProf[prof] || 0) + 1;
          });

          let totalPlantoesPac = 0;
          const linhas = Object.entries(contagemPorProf).map(([profNome, qtd]) => {
            totalPlantoesPac += qtd;
            return [profNome, `${qtd} ${qtd === 1 ? "plantão / dia" : "plantões / dias"}`];
          });

          linhas.push([
            "TOTAL DE PLANTÕES DO PACIENTE",
            `${totalPlantoesPac} plantões`
          ]);

          autoTable(doc, {
            startY: startY,
            head: [["Profissional", "Dias / Plantões Realizados"]],
            body: linhas,
            theme: "plain",
            tableWidth: 182,
            margin: { left: 14, right: 14 },
            headStyles: {
              textColor: [30, 30, 30],
              fontStyle: "bold",
              fontSize: 8.5,
              cellPadding: 2.5,
              lineWidth: { bottom: 0.5 },
              lineColor: [80, 80, 80]
            },
            bodyStyles: {
              textColor: [40, 40, 40],
              fontSize: 8,
              cellPadding: 2.2,
              lineWidth: { bottom: 0.1 },
              lineColor: [230, 230, 230]
            },
            columnStyles: {
              0: { cellWidth: 120, fontStyle: "bold" },
              1: { cellWidth: 62, halign: "center" }
            },
            didParseCell: function(data) {
              if (data.row.index === linhas.length - 1) {
                data.cell.styles.fontStyle = "bold";
                data.cell.styles.fillColor = [245, 245, 245];
                data.cell.styles.lineWidth = { top: 0.4, bottom: 0.4 };
                data.cell.styles.lineColor = [100, 100, 100];
              }
            }
          });

          startY = doc.lastAutoTable.finalY + 8;
          if (startY > 265 && idx < dadosRelatorioPaciente.length - 1) {
            doc.addPage();
            startY = 16;
          }
        });
      }

      doc.save(`relatorio-atendimentos-paciente-${dataInicial || "periodo"}.pdf`);
    } catch (err) {
      console.error("Erro ao gerar PDF de atendimentos por paciente:", err);
      alert("Ocorreu um erro ao gerar o PDF.");
    }
  };

  
  const handleBaixarPreviaFolhaPDF = () => {
    try {
      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.setTextColor(24, 61, 51);
      doc.text("VALLIDARE", 14, 14);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(100, 100, 100);
      doc.text("Gestão e Consultoria em Saúde", 14, 18);

      doc.setFontSize(11);
      doc.setTextColor(50, 50, 50);
      doc.text("Prévia Financeira da Folha de Pagamento", 14, 24);

      doc.setFontSize(8);
      doc.setTextColor(110, 110, 110);
      doc.text(`Período: ${formatarDataBr(dataInicial)} a ${formatarDataBr(dataFinal)}   |   Emitido em: ${new Date().toLocaleDateString("pt-BR")}`, 14, 29);

      doc.setDrawColor(210, 210, 210);
      doc.setLineWidth(0.3);
      doc.line(14, 31, 283, 31);

      const linhas = (dadosPreviaFolha || []).map((item) => [
        item.nome || "-",
        item.tipo || "-",
        String(item.qtd ?? 0),
        Number(item.producao || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        Number(item.ajudaCusto || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        Number(item.bruto || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      ]);

      const totalQtd = (dadosPreviaFolha || []).reduce((acc, cur) => acc + (Number(cur.qtd) || 0), 0);
      const totalProducao = (dadosPreviaFolha || []).reduce((acc, cur) => acc + (Number(cur.producao) || 0), 0);
      const totalAjuda = (dadosPreviaFolha || []).reduce((acc, cur) => acc + (Number(cur.ajudaCusto) || 0), 0);
      const totalBruto = (dadosPreviaFolha || []).reduce((acc, cur) => acc + (Number(cur.bruto) || 0), 0);

      const linhaTotal = [
        "TOTAL GERAL",
        "-",
        String(totalQtd),
        totalProducao.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        totalAjuda.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        totalBruto.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      ];

      autoTable(doc, {
        startY: 35,
        head: [["Profissional", "Tipo / Função", "Qtd Plantões", "Produção (R$)", "Ajuda Custo (R$)", "Bruto Total (R$)"]],
        body: linhas.length > 0 ? [...linhas, linhaTotal] : [["Nenhum registro encontrado", "-", "-", "-", "-", "-"]],
        theme: "plain",
        tableWidth: 269,
        margin: { left: 14, right: 14 },
        headStyles: {
          textColor: [30, 30, 30],
          fontStyle: "bold",
          fontSize: 8.5,
          cellPadding: 2.5,
          lineWidth: { bottom: 0.5 },
          lineColor: [80, 80, 80]
        },
        bodyStyles: {
          textColor: [40, 40, 40],
          fontSize: 8,
          cellPadding: 2,
          lineWidth: { bottom: 0.1 },
          lineColor: [230, 230, 230]
        },
        columnStyles: {
          0: { cellWidth: 95, fontStyle: "bold" },
          1: { cellWidth: 44 },
          2: { cellWidth: 26, halign: "center" },
          3: { cellWidth: 34, halign: "right" },
          4: { cellWidth: 34, halign: "right" },
          5: { cellWidth: 36, halign: "right", fontStyle: "bold" }
        },
        didParseCell: function(data) {
          if (linhas.length > 0 && data.row.index === linhas.length) {
            data.cell.styles.fontStyle = "bold";
            data.cell.styles.fillColor = [245, 245, 245];
            data.cell.styles.lineWidth = { top: 0.4, bottom: 0.4 };
            data.cell.styles.lineColor = [100, 100, 100];
          }
        }
      });

      doc.save(`previa-folha-${dataInicial || "periodo"}.pdf`);
    } catch (err) {
      console.error("Erro ao gerar PDF da prévia da folha:", err);
      alert("Ocorreu um erro ao gerar o PDF.");
    }
  };

  
  const handleBaixarBancosProfissionalPDF = () => {
    try {
      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.setTextColor(24, 61, 51);
      doc.text("VALLIDARE", 14, 14);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(100, 100, 100);
      doc.text("Gestão e Consultoria em Saúde", 14, 18);

      doc.setFontSize(11);
      doc.setTextColor(50, 50, 50);
      doc.text("Relação de Bancos por Profissional", 14, 24);

      const totalProfs = (dadosRelatorioBancos || []).reduce((acc, g) => acc + (g.itens ? g.itens.length : 0), 0);
      doc.setFontSize(8);
      doc.setTextColor(110, 110, 110);
      doc.text(`Instituições: ${dadosRelatorioBancos?.length || 0}   |   Profissionais: ${totalProfs}   |   Emitido em: ${new Date().toLocaleDateString("pt-BR")}`, 14, 29);

      doc.setDrawColor(210, 210, 210);
      doc.setLineWidth(0.3);
      doc.line(14, 31, 283, 31);

      let startY = 36;

      if (!dadosRelatorioBancos || dadosRelatorioBancos.length === 0) {
        doc.setFontSize(9);
        doc.setTextColor(120, 120, 120);
        doc.text("Nenhum profissional localizado.", 14, startY);
      } else {
        dadosRelatorioBancos.forEach((grupo, idx) => {
          doc.setFont("helvetica", "bold");
          doc.setFontSize(9.5);
          doc.setTextColor(24, 61, 51);
          doc.text(`Instituição: ${grupo.bancoNome || "Outros / Sem Banco"} (${grupo.itens?.length || 0} profissionais)`, 14, startY);
          startY += 3.5;

          const linhas = (grupo.itens || []).map((it) => [
            it.nome ? `${it.nome}${it.especialidade ? " (" + it.especialidade + ")" : ""}` : "-",
            it.cpf || "-",
            it.agencia || "-",
            it.conta || "-",
            it.tipoConta || "-",
            it.pix || "-",
            it.isTitular ? "Próprio" : (it.nomeTitular || "Terceiro")
          ]);

          autoTable(doc, {
            startY: startY,
            head: [["Profissional", "CPF", "Agência", "Conta", "Tipo", "Chave PIX", "Titularidade"]],
            body: linhas.length > 0 ? linhas : [["Nenhum registro para este banco", "-", "-", "-", "-", "-", "-"]],
            theme: "plain",
            tableWidth: 269,
            margin: { left: 14, right: 14 },
            headStyles: {
              textColor: [30, 30, 30],
              fontStyle: "bold",
              fontSize: 8,
              cellPadding: 2,
              lineWidth: { bottom: 0.5 },
              lineColor: [80, 80, 80]
            },
            bodyStyles: {
              textColor: [40, 40, 40],
              fontSize: 7.5,
              cellPadding: 1.8,
              lineWidth: { bottom: 0.1 },
              lineColor: [230, 230, 230],
              overflow: "linebreak"
            },
            columnStyles: {
              0: { cellWidth: 70, fontStyle: "bold" }, // Profissional
              1: { cellWidth: 30 },                    // CPF
              2: { cellWidth: 20 },                    // Agência
              3: { cellWidth: 24 },                    // Conta
              4: { cellWidth: 22 },                    // Tipo Conta
              5: { cellWidth: 65, fontStyle: "bold" }, // Chave PIX
              6: { cellWidth: 38 }                     // Titularidade
            }
          });

          startY = doc.lastAutoTable.finalY + 7;
          if (startY > 185 && idx < dadosRelatorioBancos.length - 1) {
            doc.addPage();
            startY = 16;
          }
        });
      }

      doc.save("relatorio-bancos-profissional.pdf");
    } catch (err) {
      console.error("Erro ao gerar PDF de bancos por profissional:", err);
      alert("Ocorreu um erro ao gerar o PDF de bancos.");
    }
  };

  
  const handleBaixarPreviaCuringasPDF = () => {
    try {
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

      // Cabeçalho Institucional VALLIDARE
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.setTextColor(24, 61, 51);
      doc.text("VALLIDARE", 14, 15);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(100, 100, 100);
      doc.text("Gestão e Consultoria em Saúde", 14, 19);

      doc.setFontSize(10.5);
      doc.setTextColor(50, 50, 50);
      doc.text("Prévia Financeira de Curingas (Adiantamentos de Cobertura)", 14, 25);

      doc.setFontSize(8);
      doc.setTextColor(110, 110, 110);
      doc.text(`Período: ${formatarDataBr(dataInicial)} a ${formatarDataBr(dataFinal)}   |   Emitido em: ${new Date().toLocaleDateString("pt-BR")}`, 14, 30);

      // Linha divisória limpa
      doc.setDrawColor(210, 210, 210);
      doc.setLineWidth(0.3);
      doc.line(14, 32, 196, 32);

      let totalGeralAdiantado = 0;
      let totalGeralPlantoes = 0;
      const todasLinhas = [];

      (dadosPreviaCuringas || []).forEach((grupo) => {
        (grupo.itens || []).forEach((it) => {
          const val = Number(it.producao || 0);
          totalGeralAdiantado += val;
          totalGeralPlantoes += 1;
          todasLinhas.push([
            it.profissionalNome || grupo.nome || "-",
            formatarDataBr(it.data) || "-",
            it.pacienteNome || "-",
            val.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
          ]);
        });
      });

      const linhaTotal = [
        "TOTAL GERAL ADIANTADO",
        `${totalGeralPlantoes} plantões`,
        "-",
        totalGeralAdiantado.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      ];

      autoTable(doc, {
        startY: 37,
        head: [["Profissional", "Data Realizada", "Paciente", "Valor Plantão (R$)"]],
        body: todasLinhas.length > 0 ? [...todasLinhas, linhaTotal] : [["Nenhum plantão curinga no período.", "-", "-", "0,00"]],
        theme: "plain",
        tableWidth: 182,
        margin: { left: 14, right: 14 },
        headStyles: {
          textColor: [30, 30, 30],
          fontStyle: "bold",
          fontSize: 8.5,
          cellPadding: 2.5,
          lineWidth: { bottom: 0.5 },
          lineColor: [80, 80, 80]
        },
        bodyStyles: {
          textColor: [40, 40, 40],
          fontSize: 8,
          cellPadding: 2.2,
          lineWidth: { bottom: 0.1 },
          lineColor: [230, 230, 230],
          valign: "top",
          overflow: "linebreak"
        },
        columnStyles: {
          0: { cellWidth: 62, fontStyle: "bold" },
          1: { cellWidth: 32, halign: "center" },
          2: { cellWidth: 53 },
          3: { cellWidth: 35, halign: "right", fontStyle: "bold" }
        },
        didParseCell: function(data) {
          if (todasLinhas.length > 0 && data.row.index === todasLinhas.length) {
            data.cell.styles.fontStyle = "bold";
            data.cell.styles.fillColor = [245, 245, 245];
            data.cell.styles.lineWidth = { top: 0.4, bottom: 0.4 };
            data.cell.styles.lineColor = [100, 100, 100];
          }
        }
      });

      doc.save(`previa-curingas-${dataInicial || "periodo"}.pdf`);
    } catch (err) {
      console.error("Erro ao gerar PDF de curingas:", err);
      alert("Ocorreu um erro ao gerar o PDF da prévia de curingas.");
    }
  };

  
  const handleBaixarPreviaFolhaBancosPDF = () => {
    try {
      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.setTextColor(24, 61, 51);
      doc.text("VALLIDARE", 14, 14);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(100, 100, 100);
      doc.text("Gestão e Consultoria em Saúde", 14, 18);

      doc.setFontSize(11);
      doc.setTextColor(50, 50, 50);
      doc.text("Prévia Financeira da Folha de Pagamento por Bancos / PIX", 14, 24);

      doc.setFontSize(8);
      doc.setTextColor(110, 110, 110);
      doc.text(`Período: ${formatarDataBr(dataInicial)} a ${formatarDataBr(dataFinal)}   |   Emitido em: ${new Date().toLocaleDateString("pt-BR")}`, 14, 29);

      doc.setDrawColor(210, 210, 210);
      doc.setLineWidth(0.3);
      doc.line(14, 31, 283, 31);

      let startY = 36;
      let totalGeralRepasses = 0;

      const grupos = dadosPreviaFolhaPorBancos || [];

      if (grupos.length === 0) {
        doc.setFontSize(9);
        doc.setTextColor(120, 120, 120);
        doc.text("Nenhum plantão ou valor localizado para o período selecionado.", 14, startY);
      } else {
        grupos.forEach((grupo, idx) => {
          doc.setFont("helvetica", "bold");
          doc.setFontSize(9.5);
          doc.setTextColor(24, 61, 51);
          doc.text(`Instituição Bancária: ${grupo.bancoNome || "Outros / Sem Banco"}`, 14, startY);
          startY += 3.5;

          const linhas = (grupo.itens || []).map((it) => {
            const val = Number(it.totalBruto || it.bruto || it.producao || 0);
            totalGeralRepasses += val;

            return [
              it.nome || "-",
              it.cpf || "-",
              it.agencia ? `Ag: ${it.agencia} / CC: ${it.conta || "-"}` : (it.conta || "-"),
              it.pix || it.chavePix || "-",
              String(it.plantores || it.qtd || it.totalQtd || 1),
              val.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
            ];
          });

          const subtotalBanco = Number(grupo.totalBruto || 0);
          linhas.push([
            `Subtotal ${grupo.bancoNome}`,
            "-",
            "-",
            "-",
            String(grupo.totalQtd || 0),
            subtotalBanco.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
          ]);

          autoTable(doc, {
            startY: startY,
            head: [["Profissional", "CPF", "Agência / Conta", "Chave PIX", "Plantões", "Total Bruto (R$)"]],
            body: linhas,
            theme: "plain",
            tableWidth: 269,
            margin: { left: 14, right: 14 },
            headStyles: {
              textColor: [30, 30, 30],
              fontStyle: "bold",
              fontSize: 8,
              cellPadding: 2,
              lineWidth: { bottom: 0.5 },
              lineColor: [80, 80, 80]
            },
            bodyStyles: {
              textColor: [40, 40, 40],
              fontSize: 7.5,
              cellPadding: 1.8,
              lineWidth: { bottom: 0.1 },
              lineColor: [230, 230, 230]
            },
            columnStyles: {
              0: { cellWidth: 70, fontStyle: "bold" },
              1: { cellWidth: 32 },
              2: { cellWidth: 42 },
              3: { cellWidth: 55 },
              4: { cellWidth: 25, halign: "center" },
              5: { cellWidth: 45, halign: "right", fontStyle: "bold" }
            },
            didParseCell: function(data) {
              if (data.row.index === linhas.length - 1) {
                data.cell.styles.fontStyle = "bold";
                data.cell.styles.fillColor = [245, 245, 245];
                data.cell.styles.lineWidth = { top: 0.3, bottom: 0.3 };
                data.cell.styles.lineColor = [120, 120, 120];
              }
            }
          });

          startY = doc.lastAutoTable.finalY + 7;
          if (startY > 180 && idx < grupos.length - 1) {
            doc.addPage();
            startY = 16;
          }
        });

        if (startY > 185) {
          doc.addPage();
          startY = 16;
        }

        doc.setFont("helvetica", "bold");
        doc.setFontSize(9.5);
        doc.setTextColor(24, 61, 51);
        doc.text(`TOTAL GERAL DA FOLHA: R$ ${totalGeralRepasses.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 14, startY + 4);
      }

      doc.save(`previa-folha-bancos-${dataInicial || "periodo"}.pdf`);
    } catch (err) {
      console.error("Erro ao gerar PDF da prévia por bancos:", err);
      alert("Ocorreu um erro ao gerar o PDF da folha por bancos.");
    }
  };

  
  const handleBaixarLogAgendamentosPDF = () => {
    try {
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.setTextColor(24, 61, 51);
      doc.text("VALLIDARE", 14, 15);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(100, 100, 100);
      doc.text("Gestão e Consultoria em Saúde", 14, 19);

      doc.setFontSize(10.5);
      doc.setTextColor(50, 50, 50);
      doc.text("Log de Agendamentos por Usuários Administrativos", 14, 25);

      doc.setFontSize(8);
      doc.setTextColor(110, 110, 110);
      doc.text(`Período: ${formatarDataBr(dataInicial)} a ${formatarDataBr(dataFinal)}   |   Emitido em: ${new Date().toLocaleDateString("pt-BR")}`, 14, 30);

      doc.setDrawColor(210, 210, 210);
      doc.setLineWidth(0.3);
      doc.line(14, 32, 196, 32);

      let startY = 37;
      const grupos = dadosRelatorioLog || [];

      if (grupos.length === 0) {
        doc.setFontSize(9);
        doc.setTextColor(120, 120, 120);
        doc.text("Nenhum registro encontrado para o período e filtros selecionados.", 14, startY);
      } else {
        grupos.forEach((grupo, idx) => {
          doc.setFont("helvetica", "bold");
          doc.setFontSize(9.5);
          doc.setTextColor(24, 61, 51);
          const esp = grupo.profissional?.especialidade ? ` (${grupo.profissional.especialidade})` : "";
          doc.text(`Profissional: ${grupo.profissional?.nome || "Não informado"}${esp}`, 14, startY);
          startY += 3.5;

          const linhas = (grupo.itens || []).map((it) => [
            `${formatarDataBr(it.data)} ${it.horario || ""}`,
            it.pacienteNome || "-",
            it.criadoPor || "Sistema",
            it.status || "Ativo"
          ]);

          autoTable(doc, {
            startY: startY,
            head: [["Data / Início", "Paciente", "Criado Por", "Status"]],
            body: linhas.length > 0 ? linhas : [["Nenhum registro", "-", "-", "-"]],
            theme: "plain",
            tableWidth: 182,
            margin: { left: 14, right: 14 },
            headStyles: {
              textColor: [30, 30, 30],
              fontStyle: "bold",
              fontSize: 8,
              cellPadding: 2,
              lineWidth: { bottom: 0.5 },
              lineColor: [80, 80, 80]
            },
            bodyStyles: {
              textColor: [40, 40, 40],
              fontSize: 7.5,
              cellPadding: 1.8,
              lineWidth: { bottom: 0.1 },
              lineColor: [230, 230, 230]
            },
            columnStyles: {
              0: { cellWidth: 35 },
              1: { cellWidth: 65, fontStyle: "bold" },
              2: { cellWidth: 52 },
              3: { cellWidth: 30 }
            }
          });

          startY = doc.lastAutoTable.finalY + 7;
          if (startY > 265 && idx < grupos.length - 1) {
            doc.addPage();
            startY = 16;
          }
        });
      }

      doc.save(`log-agendamentos-${dataInicial || "periodo"}.pdf`);
    } catch (err) {
      console.error("Erro ao gerar PDF do log de agendamentos:", err);
      alert("Ocorreu um erro ao gerar o PDF de log.");
    }
  };

  const handleBaixarRelatorioFaltasPDF = () => {
    try {
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

      // Cabeçalho Institucional Limpo
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.setTextColor(24, 61, 51);
      doc.text("VALLIDARE", 14, 15);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(50, 50, 50);
      doc.text("Relação de Faltas por Profissional", 14, 21);

      doc.setFontSize(8);
      doc.setTextColor(110, 110, 110);
      doc.text(`Período: ${formatarDataBr(dataInicial)} a ${formatarDataBr(dataFinal)}   |   Emitido em: ${new Date().toLocaleDateString("pt-BR")}`, 14, 26);

      // Linha sutil separadora
      doc.setDrawColor(210, 210, 210);
      doc.setLineWidth(0.3);
      doc.line(14, 28, 196, 28);

      let startY = 34;

      if (!dadosRelatorioFaltas || dadosRelatorioFaltas.length === 0) {
        doc.setFontSize(9);
        doc.setTextColor(120, 120, 120);
        doc.text("Nenhuma falta registrada para o período e filtros selecionados.", 14, startY);
      } else {
        dadosRelatorioFaltas.forEach((grupo, idx) => {
          // Bloco de Identificação do Profissional
          doc.setFont("helvetica", "bold");
          doc.setFontSize(9.5);
          doc.setTextColor(24, 61, 51);
          const esp = grupo.profissional?.especialidade ? ` (${grupo.profissional.especialidade})` : "";
          const coren = grupo.profissional?.conselho ? ` - COREN: ${grupo.profissional.conselho}` : "";
          doc.text(`Profissional: ${grupo.profissional?.nome || "Não informado"}${esp}${coren}`, 14, startY);
          startY += 3.5;

          const linhas = (grupo.itens || grupo.faltas || []).map((item) => [
            item.dataInicio || item.data || "-",
            item.pacienteNome || item.paciente || "-",
            item.evento || "Falta",
            item.motivo || item.justificativa || "-",
            item.observacao || item.obs || "-",
            item.dataFim || item.termino || "-",
            item.status || "Registrado"
          ]);

          autoTable(doc, {
            startY: startY,
            head: [["Início", "Paciente", "Evento", "Motivo", "Observação", "Término", "Status"]],
            body: linhas.length > 0 ? linhas : [["Nenhum registro detalhado", "-", "-", "-", "-", "-", "-"]],
            theme: "plain",
            tableWidth: 182,
            margin: { left: 14, right: 14 },
            headStyles: {
              textColor: [30, 30, 30],
              fontStyle: "bold",
              fontSize: 7.5,
              cellPadding: 2,
              lineWidth: { bottom: 0.5 },
              lineColor: [80, 80, 80],
              halign: "left"
            },
            bodyStyles: {
              textColor: [40, 40, 40],
              fontSize: 7,
              cellPadding: 2,
              lineWidth: { bottom: 0.1 },
              lineColor: [225, 225, 225],
              valign: "top",
              overflow: "linebreak"
            },
            columnStyles: {
              0: { cellWidth: 20 },                     // Início (DD/MM/AAAA)
              1: { cellWidth: 38, fontStyle: "bold" },  // Paciente
              2: { cellWidth: 16 },                     // Evento (Falta)
              3: { cellWidth: 36 },                     // Motivo
              4: { cellWidth: 40 },                     // Observação
              5: { cellWidth: 16 },                     // Término
              6: { cellWidth: 16 }                      // Status
            }
          });

          startY = doc.lastAutoTable.finalY + 8;

          // Quebra de página controlada
          if (startY > 265 && idx < dadosRelatorioFaltas.length - 1) {
            doc.addPage();
            startY = 16;
          }
        });
      }

      doc.save(`relatorio-faltas-${dataInicial || "periodo"}.pdf`);
    } catch (err) {
      console.error("Erro ao gerar PDF de faltas:", err);
      alert("Ocorreu um erro ao gerar o arquivo PDF.");
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="space-y-1">
        <h1 className="text-xl font-bold text-slate-800">Relatórios de Escalas e Atendimentos</h1>
        <p className="text-xs text-slate-500">
          Selecione os filtros desejados e clique em &quot;Abrir&quot; no relatório que deseja gerar.
        </p>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-xs p-5 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="space-y-1">
            <label className="block text-xs font-medium text-slate-700">Data Inicial *</label>
            <input
              type="date"
              value={dataInicial}
              onChange={(e) => setDataInicial(e.target.value)}
              className="w-full text-xs p-2.5 border border-slate-200 rounded-lg text-slate-700 bg-white focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-medium text-slate-700">Data Final *</label>
            <input
              type="date"
              value={dataFinal}
              onChange={(e) => setDataFinal(e.target.value)}
              className="w-full text-xs p-2.5 border border-slate-200 rounded-lg text-slate-700 bg-white focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-medium text-slate-700">Paciente</label>
            <select
              value={pacienteId}
              onChange={(e) => setPacienteId(e.target.value)}
              className="w-full text-xs p-2.5 border border-slate-200 rounded-lg text-slate-700 bg-white focus:outline-none focus:border-blue-500"
            >
              <option value="">Não Informado (Todos)</option>
              {pacientesOrdenados.map(p => (
                <option key={p.id} value={p.id}>{p.nome}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-medium text-slate-700">Profissional</label>
            <select
              value={profissionalId}
              onChange={(e) => setProfissionalId(e.target.value)}
              className="w-full text-xs p-2.5 border border-slate-200 rounded-lg text-slate-700 bg-white focus:outline-none focus:border-blue-500"
            >
              <option value="">Não Informado (Todos)</option>
              {profissionaisOrdenados.map(prof => (
                <option key={prof.id} value={prof.id}>{prof.nome}</option>
              ))}
            </select>
          </div>
        </div>

        <hr className="border-slate-100" />

        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={expandirTodos} className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg">Expandir todos</button>
          <button type="button" onClick={recolherTodos} className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg">Recolher todos</button>
          <button type="button" onClick={limparFiltros} className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg">Limpar filtros</button>
        </div>
      </div>

      <div className="space-y-4">
        {GRUPOS_INICIAIS.map(grupo => {
          const isExpanded = !!gruposExpandidos[grupo.id];
          return (
            <div key={grupo.id} className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
              <button
                type="button"
                onClick={() => toggleGrupo(grupo.id)}
                className="w-full flex items-center gap-2 px-5 py-3.5 bg-slate-50/70 hover:bg-slate-100/80 transition-colors text-left border-b border-slate-200"
              >
                {isExpanded ? <ChevronDown size={15} className="text-slate-600" /> : <ChevronRight size={15} className="text-slate-600" />}
                <span className="text-xs font-bold text-slate-800">{grupo.nome}</span>
                <span className="inline-flex items-center justify-center px-2 py-0.5 text-[11px] font-bold text-white bg-blue-600 rounded-full">{grupo.itens.length}</span>
              </button>

              {isExpanded && (
                <div className="divide-y divide-slate-100">
                  {grupo.itens.map(item => (
                    <div key={item.id} className="flex items-center justify-between px-5 py-4 hover:bg-slate-50/60 transition-colors gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-medium text-slate-800">{item.titulo}</span>
                          <span title={item.ajuda} className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-blue-50 text-blue-600 cursor-help">
                            <HelpCircle size={12} />
                          </span>
                        </div>
                        <p className="text-xs italic text-slate-500">{item.descricao}</p>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleAbrirRelatorio(item)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs transition-colors flex-shrink-0"
                      >
                        <Printer size={13} />
                        <span>Abrir</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Modal: Relação de Atendimentos por Paciente */}
      {modalRelatorioAtivo === 'atend_paciente' && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">
            
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #area-impressao-relatorio, #area-impressao-relatorio * { visibility: visible !important; }
          #area-impressao-relatorio {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 20px !important;
            background: white !important;
          }
          .no-print { display: none !important; }
        }
      `}</style>
            <div className="flex items-center justify-between px-6 py-4 bg-slate-800 text-white no-print">
              <div className="flex items-center gap-2">
                <Printer size={18} />
                <h3 className="text-sm font-bold">Relação de Atendimentos por Paciente</h3>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={handleBaixarAtendPacientePDF} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg">Imprimir / PDF</button>
                <button type="button" onClick={() => setModalRelatorioAtivo(null)} className="p-1.5 hover:bg-slate-700 rounded-lg text-slate-300"><X size={18} /></button>
              </div>
            </div>

            <div className="p-8 overflow-y-auto space-y-8 bg-slate-100 flex-1 print:bg-white print:p-0">
              <div id="area-impressao-relatorio" className="bg-white p-8 rounded-xl shadow-xs border border-slate-200 max-w-4xl mx-auto space-y-6 print:shadow-none print:border-none">
                <div className="flex items-center justify-between border-b border-slate-300 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-lg bg-blue-600 text-white font-bold flex items-center justify-center text-lg">V</div>
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm">VALLIDARE</h4>
                      <p className="text-[11px] text-slate-500 font-medium">Gestão e Consultoria em Saúde</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-500">Emitido em: {new Date().toLocaleDateString('pt-BR')}</p>
                  </div>
                </div>

                <div className="border-t-2 border-b-2 border-slate-800 py-3 flex items-center justify-between">
                  <h2 className="text-sm font-bold text-slate-900">Relação de Atendimentos por Paciente</h2>
                  <p className="text-xs font-semibold text-slate-700">Período de {formatarDataBr(dataInicial)} a {formatarDataBr(dataFinal)}</p>
                </div>

                {dadosRelatorioPaciente.length === 0 ? (
                  <div className="text-center py-12 text-slate-500 text-xs italic">Nenhum atendimento encontrado para o período.</div>
                ) : (
                  dadosRelatorioPaciente.map((grupo, idx) => (
                    <div key={idx} className="space-y-3 pt-2">
                      <div className="border-b border-slate-200 pb-1.5 flex justify-between text-xs text-slate-800 font-medium">
                        <span>Paciente: <strong className="text-slate-900">{grupo.paciente.nome}</strong></span>
                        <span>Contratante: <strong className="text-slate-900">{grupo.paciente.nomeResponsavel || 'Padrão'}</strong></span>
                      </div>
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-slate-100 text-slate-700 border-b border-slate-300">
                            <th className="p-2">Início</th>
                            <th className="p-2">Profissional</th>
                            <th className="p-2">Evento</th>
                            <th className="p-2">Observação</th>
                            <th className="p-2">Término</th>
                            <th className="p-2">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 text-slate-700">
                          {grupo.itens.map((item: any, i: number) => (
                            <tr key={i} className="hover:bg-slate-50/50">
                              <td className="p-2">{formatarDataBr(item.data)} {item.horario}</td>
                              <td className="p-2 font-medium text-slate-900">{item.profissionalNome}</td>
                              <td className="p-2">{item.tipoEscala}</td>
                              <td className="p-2 italic text-slate-500">{item.observacao || '-'}</td>
                              <td className="p-2">{formatarDataBr(item.data)} {item.horario === '07:00' ? '19:00' : '07:00'}</td>
                              <td className="p-2"><span className="px-2 py-0.5 text-[10px] font-semibold bg-emerald-50 text-emerald-700 rounded-md">{item.status}</span></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <div className="text-center pt-2 pb-4 border-b border-dashed border-slate-300">
                        <p className="text-xs font-bold text-slate-800">Total de Plantões do paciente {grupo.paciente.nome} : {grupo.itens.length}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Relação de Atendimentos por Profissional */}
      {modalRelatorioAtivo === 'atend_profissional' && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 bg-slate-800 text-white">
              <div className="flex items-center gap-2">
                <Printer size={18} />
                <h3 className="text-sm font-bold">Relação de Atendimentos por Profissional</h3>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={handleBaixarRelatorioFaltasPDF} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg">Imprimir / PDF</button>
                <button type="button" onClick={() => setModalRelatorioAtivo(null)} className="p-1.5 hover:bg-slate-700 rounded-lg text-slate-300"><X size={18} /></button>
              </div>
            </div>

            <div className="p-8 overflow-y-auto space-y-8 bg-slate-100 flex-1 print:bg-white print:p-0">
              <div className="bg-white p-8 rounded-xl shadow-xs border border-slate-200 max-w-4xl mx-auto space-y-6 print:shadow-none print:border-none">
                <div className="flex items-center justify-between border-b border-slate-300 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-lg bg-blue-600 text-white font-bold flex items-center justify-center text-lg">V</div>
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm">VALLIDARE</h4>
                      <p className="text-[11px] text-slate-500 font-medium">Gestão e Consultoria em Saúde</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-500">Emitido em: {new Date().toLocaleDateString('pt-BR')}</p>
                  </div>
                </div>

                <div className="border-t-2 border-b-2 border-slate-800 py-3 flex items-center justify-between">
                  <h2 className="text-sm font-bold text-slate-900">Relação de Atendimentos por Profissional</h2>
                  <p className="text-xs font-semibold text-slate-700">Período de {formatarDataBr(dataInicial)} a {formatarDataBr(dataFinal)}</p>
                </div>

                {dadosRelatorioProfissional.length === 0 ? (
                  <div className="text-center py-12 text-slate-500 text-xs italic">Nenhum atendimento encontrado para o período.</div>
                ) : (
                  dadosRelatorioProfissional.map((grupo, idx) => {
                    const pacMap = new Map((pacientes || []).map(p => [p.id, p]));
                    return (
                      <div key={idx} className="space-y-3 pt-2">
                        <div className="border-b border-slate-200 pb-1.5 flex justify-between text-xs text-slate-800 font-medium">
                          <span>
                            Profissional: <strong className="text-slate-900">{grupo.profissional.nome}</strong>
                            <span className="text-slate-500"> ({grupo.profissional.especialidade || 'Cuidador(a)'}) {grupo.profissional.conselho ? `- COREN/RJ: ${grupo.profissional.conselho}` : ''}</span>
                          </span>
                          <span>Não Informado</span>
                        </div>
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="bg-slate-100 text-slate-700 border-b border-slate-300">
                              <th className="p-2">Início</th>
                              <th className="p-2">Paciente</th>
                              <th className="p-2">Contratante</th>
                              <th className="p-2">Evento</th>
                              <th className="p-2">Observação</th>
                              <th className="p-2">Término</th>
                              <th className="p-2">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200 text-slate-700">
                            {grupo.itens.map((item: any, i: number) => {
                              const pac = pacMap.get(item.pacienteId);
                              return (
                                <tr key={i} className="hover:bg-slate-50/50">
                                  <td className="p-2">{formatarDataBr(item.data)} {item.horario}</td>
                                  <td className="p-2 font-medium text-slate-900">{pac?.nome || 'Paciente Desconhecido'}</td>
                                  <td className="p-2">{pac?.nomeResponsavel || 'Padrão'}</td>
                                  <td className="p-2">{item.tipoEscala}</td>
                                  <td className="p-2 italic text-slate-500">{item.observacao || '-'}</td>
                                  <td className="p-2">{formatarDataBr(item.data)} {item.horario === '07:00' ? '19:00' : '07:00'}</td>
                                  <td className="p-2"><span className="px-2 py-0.5 text-[10px] font-semibold bg-emerald-50 text-emerald-700 rounded-md">{item.status}</span></td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                        <div className="text-center pt-2 pb-4 border-b border-dashed border-slate-300">
                          <p className="text-xs font-bold text-slate-800">Total de Registros do Profissional {grupo.profissional.nome} : {grupo.itens.length}</p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Relação de Bancos por Profissional */}
      {modalRelatorioAtivo === 'bancos_profissional' && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-2 sm:p-4 overflow-y-auto print:p-0 print:bg-white print:static">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden print:max-h-none print:shadow-none print:border-none">
            <div className="flex items-center justify-between px-6 py-4 bg-slate-800 text-white print:hidden">
              <div className="flex items-center gap-2">
                <Printer size={18} />
                <h3 className="text-sm font-bold">Relação de Bancos por Profissional</h3>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={handleBaixarBancosProfissionalPDF} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg">Imprimir / PDF</button>
                <button type="button" onClick={() => setModalRelatorioAtivo(null)} className="p-1.5 hover:bg-slate-700 rounded-lg text-slate-300"><X size={18} /></button>
              </div>
            </div>

            <div className="p-8 overflow-y-auto space-y-6 bg-slate-100 flex-1 print:bg-white print:p-0">
              <div className="bg-white p-8 rounded-xl shadow-xs border border-slate-200 max-w-4xl mx-auto space-y-6 print:shadow-none print:border-none">
                <div className="flex items-center justify-between border-b border-slate-300 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-lg bg-blue-600 text-white font-bold flex items-center justify-center text-lg">V</div>
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm">VALLIDARE</h4>
                      <p className="text-[11px] text-slate-500 font-medium">Gestão e Consultoria em Saúde</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-500">Emitido em: {new Date().toLocaleDateString('pt-BR')}</p>
                    <p className="text-[11px] text-slate-400">Total de Instituições: {dadosRelatorioBancos.length}</p>
                  </div>
                </div>

                <div className="border-t-2 border-b-2 border-slate-800 py-3 flex items-center justify-between">
                  <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide">Relação de Bancos por Profissional</h2>
                  <span className="text-xs font-bold text-blue-700">
                    Total de Profissionais: {dadosRelatorioBancos.reduce((acc, g) => acc + g.itens.length, 0)}
                  </span>
                </div>

                {dadosRelatorioBancos.length === 0 ? (
                  <div className="text-center py-12 text-slate-500 text-xs italic">Nenhum profissional localizado.</div>
                ) : (
                  <div className="space-y-6">
                    {dadosRelatorioBancos.map((grupo, gIdx) => (
                      <div key={gIdx} className="border border-slate-200 rounded-lg overflow-hidden break-inside-avoid shadow-xs bg-white">
                        {/* Header da Instituição Bancária */}
                        <div className="bg-slate-100 border-b border-slate-200 px-4 py-2.5 flex items-center justify-between">
                          <span className="font-bold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-2">
                            <span>🏛️</span> {grupo.bancoNome}
                          </span>
                          <span className="text-[11px] font-semibold text-slate-700 bg-white border border-slate-300 px-2.5 py-0.5 rounded-full">
                            {grupo.itens.length} {grupo.itens.length === 1 ? 'profissional' : 'profissionais'}
                          </span>
                        </div>

                        {/* Listagem dos profissionais deste banco */}
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold text-[11px]">
                              <th className="p-2.5">Profissional</th>
                              <th className="p-2.5">CPF</th>
                              <th className="p-2.5">Agência</th>
                              <th className="p-2.5">Conta</th>
                              <th className="p-2.5">Tipo</th>
                              <th className="p-2.5">Chave PIX</th>
                              <th className="p-2.5">Titularidade</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 text-slate-700">
                            {grupo.itens.map((it: any, iIdx: number) => (
                              <tr key={it.id || iIdx} className="hover:bg-slate-50/60">
                                <td className="p-2.5 font-medium text-slate-900">
                                  {it.nome}
                                  <div className="text-[10px] text-slate-500 font-normal">{it.especialidade}</div>
                                </td>
                                <td className="p-2.5 font-mono text-slate-600 text-[11px]">{it.cpf}</td>
                                <td className="p-2.5 font-mono">{it.agencia}</td>
                                <td className="p-2.5 font-mono">{it.conta}</td>
                                <td className="p-2.5 capitalize text-slate-600">{it.tipoConta}</td>
                                <td className="p-2.5 font-mono font-medium text-emerald-700">{it.pix}</td>
                                <td className="p-2.5 text-slate-600 text-[11px]">
                                  {it.isTitular ? 'Próprio' : (it.nomeTitular || 'Terceiro')}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr className="bg-slate-50/80 border-t border-slate-200 text-slate-600 font-medium text-[11px]">
                              <td colSpan={7} className="p-2 text-right">
                                Subtotal {grupo.bancoNome}: <strong>{grupo.itens.length}</strong>
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    ))}

                    <div className="pt-4 border-t border-slate-200 flex justify-between items-center text-xs text-slate-600">
                      <span>Total Geral de Profissionais Listados</span>
                      <strong className="text-sm text-slate-900">{dadosRelatorioBancos.reduce((acc, g) => acc + g.itens.length, 0)}</strong>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Relação de Faltas por Profissional */}
      {modalRelatorioAtivo === 'faltas_profissional' && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 bg-slate-800 text-white">
              <div className="flex items-center gap-2">
                <Printer size={18} />
                <h3 className="text-sm font-bold">Relação de Faltas por Profissional</h3>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={handleBaixarRelatorioFaltasPDF} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg">Imprimir / PDF</button>
                <button type="button" onClick={() => setModalRelatorioAtivo(null)} className="p-1.5 hover:bg-slate-700 rounded-lg text-slate-300"><X size={18} /></button>
              </div>
            </div>

            <div className="p-8 overflow-y-auto space-y-8 bg-slate-100 flex-1 print:bg-white print:p-0">
              <div className="bg-white p-8 rounded-xl shadow-xs border border-slate-200 max-w-4xl mx-auto space-y-6 print:shadow-none print:border-none">
                <div className="flex items-center justify-between border-b border-slate-300 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-lg bg-blue-600 text-white font-bold flex items-center justify-center text-lg">V</div>
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm">VALLIDARE</h4>
                      <p className="text-[11px] text-slate-500 font-medium">Gestão e Consultoria em Saúde</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-500">Emitido em: {new Date().toLocaleDateString('pt-BR')}</p>
                  </div>
                </div>

                <div className="border-t-2 border-b-2 border-slate-800 py-3 flex items-center justify-between">
                  <h2 className="text-sm font-bold text-slate-900">Relação de Faltas por Profissional</h2>
                  <p className="text-xs font-semibold text-slate-700">Período de {formatarDataBr(dataInicial)} a {formatarDataBr(dataFinal)}</p>
                </div>

                {dadosRelatorioFaltas.length === 0 ? (
                  <div className="text-center py-12 text-slate-500 text-xs italic">Nenhuma falta registrada para o período e filtros selecionados.</div>
                ) : (
                  dadosRelatorioFaltas.map((grupo, idx) => (
                    <div key={idx} className="space-y-3 pt-2">
                      <div className="border-b border-slate-200 pb-1.5 flex justify-between text-xs text-slate-800 font-medium">
                        <span>
                          Profissional: <strong className="text-slate-900">{grupo.profissional.nome}</strong>
                          <span className="text-slate-500"> ({grupo.profissional.especialidade || 'Cuidador(a)'}) {grupo.profissional.conselho ? `- COREN/RJ: ${grupo.profissional.conselho}` : ''}</span>
                        </span>
                        <span>Não Informado</span>
                      </div>
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-slate-100 text-slate-700 border-b border-slate-300">
                            <th className="p-2">Início</th>
                            <th className="p-2">Paciente</th>
                            <th className="p-2">Evento</th>
                            <th className="p-2">Motivo</th>
                            <th className="p-2">Observação</th>
                            <th className="p-2">Término</th>
                            <th className="p-2">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 text-slate-700">
                          {grupo.itens.map((item: any, i: number) => (
                            <tr key={i} className="hover:bg-slate-50/50">
                              <td className="p-2 whitespace-nowrap">{formatarDataBr(item.data)} {item.horario}</td>
                              <td className="p-2 font-medium text-slate-900">{item.pacienteNome}</td>
                              <td className="p-2 whitespace-nowrap">{item.tipoEscala}</td>
                              <td className="p-2 text-rose-700 font-medium">{item.motivo}</td>
                              <td className="p-2 italic text-slate-500">{item.observacao}</td>
                              <td className="p-2 whitespace-nowrap">{formatarDataBr(item.data)} {item.horario === '07:00' ? '19:00' : '07:00'}</td>
                              <td className="p-2 whitespace-nowrap">
                                <span className="px-2 py-0.5 text-[10px] font-semibold bg-rose-50 text-rose-700 rounded-md border border-rose-200">
                                  {item.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <div className="text-center pt-2 pb-4 border-b border-dashed border-slate-300">
                        <p className="text-xs font-bold text-slate-800">Total de Registros do Profissional {grupo.profissional.nome} : {grupo.itens.length}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Prévia Financeira da Folha de Pagamento Por Bancos */}
      {modalRelatorioAtivo === 'previa_folha_bancos' && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-2 sm:p-4 overflow-y-auto print:p-0 print:bg-white print:static">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden print:max-h-none print:shadow-none print:border-none">
            <div className="flex items-center justify-between px-6 py-4 bg-slate-800 text-white print:hidden">
              <div className="flex items-center gap-2">
                <Printer size={18} />
                <h3 className="text-sm font-bold">Prévia Financeira da Folha de Pagamento Por Bancos</h3>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={handleBaixarPreviaFolhaBancosPDF} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg">Imprimir / PDF</button>
                <button type="button" onClick={() => setModalRelatorioAtivo(null)} className="p-1.5 hover:bg-slate-700 rounded-lg text-slate-300"><X size={18} /></button>
              </div>
            </div>

            <div className="p-8 overflow-y-auto space-y-6 bg-slate-100 flex-1 print:bg-white print:p-0">
              <div className="bg-white p-8 rounded-xl shadow-xs border border-slate-200 max-w-5xl mx-auto space-y-6 print:shadow-none print:border-none">
                <div className="flex items-center justify-between border-b border-slate-300 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-lg bg-blue-600 text-white font-bold flex items-center justify-center text-lg">V</div>
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm">VALLIDARE</h4>
                      <p className="text-[11px] text-slate-500 font-medium">Gestão e Consultoria em Saúde</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-500">Emitido em: {new Date().toLocaleDateString('pt-BR')}</p>
                    <p className="text-[11px] text-slate-400">Total de Instituições: {dadosPreviaFolhaPorBancos.length}</p>
                  </div>
                </div>

                <div className="border-t-2 border-b-2 border-slate-800 py-3 flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide">Prévia Financeira da Folha de Pagamento Por Bancos</h2>
                    <p className="text-xs text-slate-600 font-medium">Período: {formatarDataBr(dataInicial)} a {formatarDataBr(dataFinal)}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-slate-500 block">Total Geral Previsto</span>
                    <strong className="text-base font-bold text-emerald-700">
                      {formatarMoeda(dadosPreviaFolhaPorBancos.reduce((acc, g) => acc + g.totalBruto, 0))}
                    </strong>
                  </div>
                </div>

                {dadosPreviaFolhaPorBancos.length === 0 ? (
                  <div className="text-center py-12 text-slate-500 text-xs italic">Nenhum plantão ou valor localizado para o período selecionado.</div>
                ) : (
                  <div className="space-y-6">
                    {dadosPreviaFolhaPorBancos.map((grupo, gIdx) => (
                      <div key={gIdx} className="border border-slate-200 rounded-lg overflow-hidden break-inside-avoid shadow-xs bg-white">
                        {/* Cabeçalho do Banco */}
                        <div className="bg-slate-100 border-b border-slate-200 px-4 py-2.5 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-base">🏦</span>
                            <span className="font-bold text-slate-800 text-xs uppercase tracking-wider">{grupo.bancoNome}</span>
                            <span className="text-[11px] font-semibold text-slate-600 bg-white border border-slate-300 px-2 py-0.5 rounded-full ml-2">
                              {grupo.itens.length} {grupo.itens.length === 1 ? 'profissional' : 'profissionais'} ({grupo.totalQtd} plantões)
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="text-[11px] text-slate-500 mr-2">Subtotal Banco:</span>
                            <strong className="text-xs font-bold text-slate-900">{formatarMoeda(grupo.totalBruto)}</strong>
                          </div>
                        </div>

                        {/* Tabela dos Profissionais */}
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold text-[11px]">
                              <th className="p-2.5">Profissional</th>
                              <th className="p-2.5">CPF</th>
                              <th className="p-2.5">Agência / Conta</th>
                              <th className="p-2.5">Chave PIX</th>
                              <th className="p-2.5 text-center">Plantões</th>
                              <th className="p-2.5 text-right">Produção</th>
                              <th className="p-2.5 text-right">Adicionais</th>
                              <th className="p-2.5 text-right font-bold text-slate-900">Total Bruto</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 text-slate-700">
                            {grupo.itens.map((it: any, iIdx: number) => (
                              <tr key={it.id || iIdx} className="hover:bg-slate-50/60">
                                <td className="p-2.5 font-medium text-slate-900">{it.nome}</td>
                                <td className="p-2.5 font-mono text-slate-600 text-[11px]">{it.cpf}</td>
                                <td className="p-2.5 font-mono text-[11px]">
                                  {it.agencia !== '-' || it.conta !== '-' ? `Ag: ${it.agencia} | Cc: ${it.conta}` : '-'}
                                </td>
                                <td className="p-2.5 font-mono font-medium text-emerald-700 text-[11px]">{it.pix}</td>
                                <td className="p-2.5 text-center font-semibold">{it.qtd}</td>
                                <td className="p-2.5 text-right">{formatarMoeda(it.producao)}</td>
                                <td className="p-2.5 text-right">{it.ajudaCusto > 0 ? formatarMoeda(it.ajudaCusto) : '-'}</td>
                                <td className="p-2.5 text-right font-bold text-slate-900">{formatarMoeda(it.bruto)}</td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr className="bg-slate-50/90 border-t border-slate-200 text-slate-700 font-semibold text-[11px]">
                              <td colSpan={4} className="p-2.5 text-right uppercase text-slate-500">Subtotal {grupo.bancoNome}:</td>
                              <td className="p-2.5 text-center">{grupo.totalQtd}</td>
                              <td className="p-2.5 text-right">{formatarMoeda(grupo.totalProducao)}</td>
                              <td className="p-2.5 text-right">{formatarMoeda(grupo.totalAjuda)}</td>
                              <td className="p-2.5 text-right font-bold text-emerald-700">{formatarMoeda(grupo.totalBruto)}</td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    ))}

                    {/* Consolidação Geral */}
                    <div className="p-4 bg-slate-900 text-white rounded-lg flex items-center justify-between text-xs">
                      <div>
                        <span className="font-bold uppercase tracking-wider block">Consolidação Geral da Folha</span>
                        <span className="text-slate-400 text-[11px]">
                          {dadosPreviaFolhaPorBancos.reduce((acc, g) => acc + g.itens.length, 0)} profissionais em {dadosPreviaFolhaPorBancos.length} bancos | Total de {dadosPreviaFolhaPorBancos.reduce((acc, g) => acc + g.totalQtd, 0)} plantões
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-slate-400 text-[11px] block">Valor Total Líquido/Bruto Previsto</span>
                        <span className="text-base font-bold text-emerald-400">
                          {formatarMoeda(dadosPreviaFolhaPorBancos.reduce((acc, g) => acc + g.totalBruto, 0))}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}


      {/* Modal: Prévia Financeira da Folha de Pagamento */}
      {modalRelatorioAtivo === 'previa_folha' && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 bg-slate-800 text-white">
              <div className="flex items-center gap-2">
                <Printer size={18} />
                <h3 className="text-sm font-bold">Prévia Financeira da Folha de Pagamento</h3>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={handleBaixarPreviaFolhaPDF} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg">Imprimir / PDF</button>
                <button type="button" onClick={() => setModalRelatorioAtivo(null)} className="p-1.5 hover:bg-slate-700 rounded-lg text-slate-300"><X size={18} /></button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto space-y-6 bg-slate-100 flex-1 print:bg-white print:p-0">
              <div className="bg-white p-6 rounded-xl shadow-xs border border-slate-200 w-full mx-auto space-y-4 print:shadow-none print:border-none">
                <div className="flex items-center justify-between border-b border-slate-300 pb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-600 text-white font-bold flex items-center justify-center text-lg">V</div>
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm">VALLIDARE</h4>
                      <p className="text-[10px] text-slate-500 font-medium">Gestão e Consultoria em Saúde</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-500">Emitido em: {new Date().toLocaleDateString('pt-BR')}</p>
                  </div>
                </div>

                <div className="border-t-2 border-b-2 border-slate-800 py-2.5 flex items-center justify-between">
                  <h2 className="text-xs font-bold text-slate-900 uppercase">Prévia Financeira da Folha de Pagamento - Período de {formatarDataBr(dataInicial)} a {formatarDataBr(dataFinal)}</h2>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-[11px] border-collapse">
                    <thead>
                      <tr className="bg-slate-100 text-slate-700 border-b border-slate-300">
                        <th className="p-1.5">Profissional</th>
                        <th className="p-1.5">Tipo</th>
                        <th className="p-1.5 text-center">Qtd</th>
                        <th className="p-1.5 text-right">Salário</th>
                        <th className="p-1.5 text-right">Produção</th>
                        <th className="p-1.5 text-right">Insal.</th>
                        <th className="p-1.5 text-right">Peric.</th>
                        <th className="p-1.5 text-right">Ad.Not.</th>
                        <th className="p-1.5 text-right">DSR</th>
                        <th className="p-1.5 text-right">H.Extra</th>
                        <th className="p-1.5 text-right">Aj.Custo</th>
                        <th className="p-1.5 text-right font-bold">Bruto</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-slate-700">
                      {dadosPreviaFolha.map((item: any, i: number) => (
                        <tr key={i} className="hover:bg-slate-50/50">
                          <td className="p-1.5 font-medium text-slate-900">{item.nome}</td>
                          <td className="p-1.5 text-slate-500">{item.tipo}</td>
                          <td className="p-1.5 text-center">{item.qtd}</td>
                          <td className="p-1.5 text-right">0,00</td>
                          <td className="p-1.5 text-right">{item.producao.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                          <td className="p-1.5 text-right">0,00</td>
                          <td className="p-1.5 text-right">0,00</td>
                          <td className="p-1.5 text-right">0,00</td>
                          <td className="p-1.5 text-right">0,00</td>
                          <td className="p-1.5 text-right">0,00</td>
                          <td className="p-1.5 text-right">{item.ajudaCusto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                          <td className="p-1.5 text-right font-bold text-slate-900">{item.bruto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-50 font-bold border-t-2 border-slate-400 text-slate-900">
                        <td className="p-2" colSpan={2}>Total Geral ({dadosPreviaFolha.length} profissionais)</td>
                        <td className="p-2 text-center">{dadosPreviaFolha.reduce((acc: number, p: any) => acc + p.qtd, 0)}</td>
                        <td className="p-2 text-right">0,00</td>
                        <td className="p-2 text-right">{dadosPreviaFolha.reduce((acc: number, p: any) => acc + p.producao, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                        <td className="p-2 text-right" colSpan={5}>-</td>
                        <td className="p-2 text-right">{dadosPreviaFolha.reduce((acc: number, p: any) => acc + p.ajudaCusto, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                        <td className="p-2 text-right text-emerald-700 font-extrabold">{dadosPreviaFolha.reduce((acc: number, p: any) => acc + p.bruto, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Prévia Financeira de Curingas */}
      {modalRelatorioAtivo === 'previa_curingas' && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 bg-slate-800 text-white">
              <div className="flex items-center gap-2">
                <Printer size={18} />
                <h3 className="text-sm font-bold">Prévia Financeira de Curingas</h3>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={handleBaixarPreviaCuringasPDF} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg">Imprimir / PDF</button>
                <button type="button" onClick={() => setModalRelatorioAtivo(null)} className="p-1.5 hover:bg-slate-700 rounded-lg text-slate-300"><X size={18} /></button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto space-y-6 bg-slate-100 flex-1 print:bg-white print:p-0">
              <div className="bg-white p-6 rounded-xl shadow-xs border border-slate-200 w-full mx-auto space-y-5 print:shadow-none print:border-none">
                <div className="flex items-center justify-between border-b border-slate-300 pb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-600 text-white font-bold flex items-center justify-center text-lg">V</div>
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm">VALLIDARE</h4>
                      <p className="text-[10px] text-slate-500 font-medium">Gestão e Consultoria em Saúde</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-500">Emitido em: {new Date().toLocaleDateString('pt-BR')}</p>
                  </div>
                </div>

                <div className="border-t-2 border-b-2 border-slate-800 py-2.5 flex items-center justify-between">
                  <h2 className="text-xs font-bold text-slate-900 uppercase">Prévia Financeira de Curingas - Período de {formatarDataBr(dataInicial)} a {formatarDataBr(dataFinal)}</h2>
                </div>

                {dadosPreviaCuringas.length === 0 ? (
                  <div className="text-center py-12 text-slate-500 text-xs italic">Nenhum registro de curinga encontrado para o período selecionado.</div>
                ) : (
                  dadosPreviaCuringas.map((cur: any, idx: number) => (
                    <div key={idx} className="space-y-2 pt-2">
                      <div className="border-b border-slate-200 pb-1 text-xs text-slate-800 font-medium">
                        Profissional: <strong className="text-slate-900">{cur.nome}</strong>
                      </div>
                      <table className="w-full text-left text-[11px] border-collapse">
                        <thead>
                          <tr className="bg-slate-100 text-slate-700 border-b border-slate-300">
                            <th className="p-1.5">Início</th>
                            <th className="p-1.5">Término</th>
                            <th className="p-1.5">Paciente</th>
                            <th className="p-1.5">Evento</th>
                            <th className="p-1.5 text-right">Produção</th>
                            <th className="p-1.5 text-right">V.Hora</th>
                            <th className="p-1.5 text-right">Tx. Adm.</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 text-slate-700">
                          {cur.itens.map((it: any, i: number) => (
                            <tr key={i} className="hover:bg-slate-50/50">
                              <td className="p-1.5">{formatarDataBr(it.data)} {it.horario}</td>
                              <td className="p-1.5">{formatarDataBr(it.data)} 08:00</td>
                              <td className="p-1.5 font-medium text-slate-900">{it.pacienteNome}</td>
                              <td className="p-1.5">{it.evento}</td>
                              <td className="p-1.5 text-right">{it.producao.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                              <td className="p-1.5 text-right">{it.vHora.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                              <td className="p-1.5 text-right">{it.txAdm.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="bg-slate-50 font-bold border-t border-slate-300 text-slate-900">
                            <td className="p-1.5" colSpan={4}>Total {cur.nome} : {cur.itens.length}</td>
                            <td className="p-1.5 text-right">{cur.totalProducao.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                            <td className="p-1.5 text-right">-</td>
                            <td className="p-1.5 text-right">{cur.totalTxAdm.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Log de Agendamentos por Usuários Administrativos */}
      {modalRelatorioAtivo === 'log_agendamentos' && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 bg-slate-800 text-white">
              <div className="flex items-center gap-2">
                <Printer size={18} />
                <h3 className="text-sm font-bold">Log de Agendamentos por Usuários Administrativos</h3>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={handleBaixarLogAgendamentosPDF} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg">Imprimir / PDF</button>
                <button type="button" onClick={() => setModalRelatorioAtivo(null)} className="p-1.5 hover:bg-slate-700 rounded-lg text-slate-300"><X size={18} /></button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto space-y-6 bg-slate-100 flex-1 print:bg-white print:p-0">
              <div className="bg-white p-6 rounded-xl shadow-xs border border-slate-200 w-full mx-auto space-y-4 print:shadow-none print:border-none">
                <div className="flex items-center justify-between border-b border-slate-300 pb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-600 text-white font-bold flex items-center justify-center text-lg">V</div>
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm">VALLIDARE</h4>
                      <p className="text-[10px] text-slate-500 font-medium">Gestão e Consultoria em Saúde</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-500">Emitido em: {new Date().toLocaleDateString('pt-BR')}</p>
                  </div>
                </div>

                <div className="border-t-2 border-b-2 border-slate-800 py-2.5 flex items-center justify-between">
                  <h2 className="text-xs font-bold text-slate-900 uppercase">Log de Agendamentos por Usuários Administrativos</h2>
                  <p className="text-xs font-semibold text-slate-700">Período de {formatarDataBr(dataInicial)} a {formatarDataBr(dataFinal)}</p>
                </div>

                {dadosRelatorioLog.length === 0 ? (
                  <div className="text-center py-12 text-slate-500 text-xs italic">Nenhum registro encontrado para o período e filtros selecionados.</div>
                ) : (
                  dadosRelatorioLog.map((grupo: any, idx: number) => (
                    <div key={idx} className="space-y-2 pt-2">
                      <div className="border-b border-slate-200 pb-1 text-xs text-slate-800 font-medium flex justify-between">
                        <span>
                          Profissional: <strong className="text-slate-900">{grupo.profissional.nome}</strong>
                          <span className="text-slate-500"> ({grupo.profissional.especialidade}) {grupo.profissional.conselho ? `- COREN/RJ: ${grupo.profissional.conselho}` : ''}</span>
                        </span>
                        <span>Não Informado</span>
                      </div>
                      <table className="w-full text-left text-[11px] border-collapse">
                        <thead>
                          <tr className="bg-slate-100 text-slate-700 border-b border-slate-300">
                            <th className="p-1.5">Início</th>
                            <th className="p-1.5">Profissional</th>
                            <th className="p-1.5">Telefone</th>
                            <th className="p-1.5">Paciente</th>
                            <th className="p-1.5">Criado Por</th>
                            <th className="p-1.5">Término</th>
                            <th className="p-1.5">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 text-slate-700">
                          {grupo.itens.map((it: any, i: number) => (
                            <tr key={i} className="hover:bg-slate-50/50">
                              <td className="p-1.5 whitespace-nowrap">{formatarDataBr(it.data)} {it.horario}</td>
                              <td className="p-1.5 font-medium text-slate-900">{it.profissionalNome}</td>
                              <td className="p-1.5 whitespace-nowrap text-slate-600">{it.telefone}</td>
                              <td className="p-1.5 font-medium text-slate-900">{it.pacienteNome}</td>
                              <td className="p-1.5 text-blue-700 font-medium">{it.criadoPor}</td>
                              <td className="p-1.5 whitespace-nowrap">{formatarDataBr(it.data)} {it.horario === '07:00' ? '19:00' : '08:00'}</td>
                              <td className="p-1.5 whitespace-nowrap">
                                <span className="px-2 py-0.5 text-[10px] font-semibold bg-emerald-50 text-emerald-700 rounded-md border border-emerald-200">
                                  {it.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="bg-slate-50 font-bold border-t border-slate-300 text-slate-900">
                            <td className="p-2 text-center" colSpan={7}>
                              Total de Registros do Profissional {grupo.profissional.nome} : {grupo.itens.length}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default Relatorios;
