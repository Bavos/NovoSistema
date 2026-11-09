import React, { useState } from 'react';
import { Calendar, Users, DollarSign, Play, CheckCircle2, ChevronRight } from 'lucide-react';

export const DataExplorer: React.FC = () => {
  const [activeDomain, setActiveDomain] = useState<'escalas' | 'cadastros' | 'faturamento'>('escalas');
  const [testResult, setTestResult] = useState<Record<string, unknown> | null>(null);
  const [isTesting, setIsTesting] = useState(false);

  const runDirectTest = async (domain: 'escalas' | 'cadastros' | 'faturamento') => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await fetch(`/api/test/funcoes?funcao=${domain}`);
      const data = await res.json();
      setTestResult(data);
    } catch (e: unknown) {
      setTestResult({ erro: e instanceof Error ? e.message : String(e) });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Barra de Seleção de Domínio */}
      <div className="bg-white border border-slate-200 rounded-lg p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Base de Dados e Esquemas da RH Gestão Domiciliar</h3>
            <p className="text-xs text-slate-500">
              Estruturas operacionais consultadas pelas ferramentas do Teco via API corporativa ou simulador local.
            </p>
          </div>

          {/* Segmented Control */}
          <div className="flex items-center p-1 bg-slate-100 rounded-md">
            <button
              onClick={() => { setActiveDomain('escalas'); setTestResult(null); }}
              className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap ${
                activeDomain === 'escalas' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Escalas de Plantão</span>
            </button>
            <button
              onClick={() => { setActiveDomain('cadastros'); setTestResult(null); }}
              className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap ${
                activeDomain === 'cadastros' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Cadastros Operacionais</span>
            </button>
            <button
              onClick={() => { setActiveDomain('faturamento'); setTestResult(null); }}
              className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap ${
                activeDomain === 'faturamento' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <DollarSign className="w-3.5 h-3.5" />
              <span>Faturamento e Glosas</span>
            </button>
          </div>
        </div>

        {/* Informações da Ferramenta Vinculada */}
        <div className="mt-4 p-3 bg-slate-50 rounded border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div>
            <span className="text-slate-500">Tool Gemini associada: </span>
            <span className="font-mono-code font-bold text-slate-900">
              {activeDomain === 'escalas' && 'consultar_escalas(data_inicio, data_fim?, status?, paciente_id?)'}
              {activeDomain === 'cadastros' && 'consultar_cadastro(tipo, termo_busca)'}
              {activeDomain === 'faturamento' && 'consultar_faturamento(competencia, status_pagamento?)'}
            </span>
          </div>

          <button
            onClick={() => runDirectTest(activeDomain)}
            disabled={isTesting}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 text-white hover:bg-slate-800 rounded font-medium transition-colors shrink-0 disabled:opacity-50"
          >
            <Play className={`w-3 h-3 ${isTesting ? 'animate-spin' : ''}`} />
            <span>Disparar Consulta de Teste</span>
          </button>
        </div>

        {/* Resultado do Teste Direto */}
        {testResult && (
          <div className="mt-4 p-4 bg-slate-900 text-slate-200 rounded font-mono-code text-xs">
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800 text-[11px] text-slate-400">
              <span>Resposta recebida do Gateway:</span>
              <span className="text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Status OK
              </span>
            </div>
            <pre className="max-h-72 overflow-y-auto overflow-x-auto whitespace-pre-wrap">
              {JSON.stringify(testResult, null, 2)}
            </pre>
          </div>
        )}
      </div>

      {/* Tabelas de Dados Ilustrativas do Home Care */}
      {activeDomain === 'escalas' && (
        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
            Exemplos de Escalas Ativas (Home Care)
          </h4>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3 font-semibold">ID</th>
                  <th className="py-2.5 px-3 font-semibold">Data / Turno</th>
                  <th className="py-2.5 px-3 font-semibold">Paciente</th>
                  <th className="py-2.5 px-3 font-semibold">Profissional Multi</th>
                  <th className="py-2.5 px-3 font-semibold">Categoria</th>
                  <th className="py-2.5 px-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <tr>
                  <td className="py-2.5 px-3 font-mono-code font-medium">ESC-2026-001</td>
                  <td className="py-2.5 px-3">06/11/2026 · Diurno 12h (07h-19h)</td>
                  <td className="py-2.5 px-3 font-medium">Dona Helena Silveira</td>
                  <td className="py-2.5 px-3">Juliana Mendes</td>
                  <td className="py-2.5 px-3 text-slate-600">Técnica de Enfermagem</td>
                  <td className="py-2.5 px-3"><span className="text-emerald-700 font-semibold">Confirmado</span></td>
                </tr>
                <tr>
                  <td className="py-2.5 px-3 font-mono-code font-medium">ESC-2026-002</td>
                  <td className="py-2.5 px-3">06/11/2026 · Noturno 12h (19h-07h)</td>
                  <td className="py-2.5 px-3 font-medium">Dona Helena Silveira</td>
                  <td className="py-2.5 px-3">Marcos Vinicius Lima</td>
                  <td className="py-2.5 px-3 text-slate-600">Técnico de Enfermagem</td>
                  <td className="py-2.5 px-3"><span className="text-emerald-700 font-semibold">Confirmado</span></td>
                </tr>
                <tr>
                  <td className="py-2.5 px-3 font-mono-code font-medium">ESC-2026-003</td>
                  <td className="py-2.5 px-3">06/11/2026 · Sessão 1h (14h-15h)</td>
                  <td className="py-2.5 px-3 font-medium">Carlos Alberto Santos</td>
                  <td className="py-2.5 px-3">Dra. Beatriz Fontana</td>
                  <td className="py-2.5 px-3 text-slate-600">Fisioterapeuta (CREFITO)</td>
                  <td className="py-2.5 px-3"><span className="text-emerald-700 font-semibold">Confirmado</span></td>
                </tr>
                <tr>
                  <td className="py-2.5 px-3 font-mono-code font-medium">ESC-2026-005</td>
                  <td className="py-2.5 px-3">07/11/2026 · Plantão 12h (08h-20h)</td>
                  <td className="py-2.5 px-3 font-medium">Maria Clara Ribeiro</td>
                  <td className="py-2.5 px-3">Ricardo Azevedo</td>
                  <td className="py-2.5 px-3 text-slate-600">Cuidador</td>
                  <td className="py-2.5 px-3"><span className="text-amber-700 font-semibold">Pendente</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeDomain === 'cadastros' && (
        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
            Exemplos de Cadastros Operacionais (Home Care)
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-3.5 bg-slate-50 rounded border border-slate-200 text-xs space-y-1.5">
              <span className="text-slate-400 font-mono-code text-[11px]">PAC-101 · Paciente</span>
              <h5 className="font-semibold text-slate-900">Dona Helena Silveira (78 anos)</h5>
              <p className="text-slate-600">Alta Complexidade (Home Care 24h)</p>
              <p className="text-slate-500">Convênio: Unimed Seguros (Carteirinha 0054-992144-01)</p>
              <p className="text-slate-500">Responsável: Rodrigo Silveira (Filho)</p>
            </div>
            <div className="p-3.5 bg-slate-50 rounded border border-slate-200 text-xs space-y-1.5">
              <span className="text-slate-400 font-mono-code text-[11px]">PAC-102 · Paciente</span>
              <h5 className="font-semibold text-slate-900">Carlos Alberto Santos (69 anos)</h5>
              <p className="text-slate-600">Média Complexidade (Plantão 12h Diurno + Fisio)</p>
              <p className="text-slate-500">Convênio: Bradesco Saúde</p>
              <p className="text-slate-500">Responsável: Carla Santos (Esposa)</p>
            </div>
            <div className="p-3.5 bg-slate-50 rounded border border-slate-200 text-xs space-y-1.5">
              <span className="text-slate-400 font-mono-code text-[11px]">PRO-503 · Profissional</span>
              <h5 className="font-semibold text-slate-900">Dra. Beatriz Fontana</h5>
              <p className="text-slate-600">Fisioterapeuta (CREFITO-3 154.982-F)</p>
              <p className="text-slate-500">Especialidade: Respiratória e Motora</p>
              <p className="text-slate-500">Telefone: (11) 99345-3333</p>
            </div>
          </div>
        </div>
      )}

      {activeDomain === 'faturamento' && (
        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
            Exemplos de Lotes de Faturamento
          </h4>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono-code">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3 font-semibold">Lote ID</th>
                  <th className="py-2.5 px-3 font-semibold">Competência</th>
                  <th className="py-2.5 px-3 font-semibold">Convênio</th>
                  <th className="py-2.5 px-3 font-semibold">Atendimentos</th>
                  <th className="py-2.5 px-3 font-semibold">Valor Bruto</th>
                  <th className="py-2.5 px-3 font-semibold">Glosa</th>
                  <th className="py-2.5 px-3 font-semibold">Valor Líquido</th>
                  <th className="py-2.5 px-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <tr>
                  <td className="py-2.5 px-3 font-medium">FAT-2026-10-01</td>
                  <td className="py-2.5 px-3">10/2026</td>
                  <td className="py-2.5 px-3">Unimed Seguros</td>
                  <td className="py-2.5 px-3">124</td>
                  <td className="py-2.5 px-3">R$ 84.500,00</td>
                  <td className="py-2.5 px-3 text-rose-600">R$ 1.200,00</td>
                  <td className="py-2.5 px-3 font-bold text-slate-900">R$ 83.300,00</td>
                  <td className="py-2.5 px-3 text-emerald-700 font-bold">Pago</td>
                </tr>
                <tr>
                  <td className="py-2.5 px-3 font-medium">FAT-2026-10-02</td>
                  <td className="py-2.5 px-3">10/2026</td>
                  <td className="py-2.5 px-3">Bradesco Saúde</td>
                  <td className="py-2.5 px-3">98</td>
                  <td className="py-2.5 px-3">R$ 62.300,00</td>
                  <td className="py-2.5 px-3 text-slate-400">R$ 0,00</td>
                  <td className="py-2.5 px-3 font-bold text-slate-900">R$ 62.300,00</td>
                  <td className="py-2.5 px-3 text-amber-700 font-bold">Pendente</td>
                </tr>
                <tr>
                  <td className="py-2.5 px-3 font-medium">FAT-2026-10-03</td>
                  <td className="py-2.5 px-3">10/2026</td>
                  <td className="py-2.5 px-3">SulAmérica</td>
                  <td className="py-2.5 px-3">60</td>
                  <td className="py-2.5 px-3">R$ 39.800,00</td>
                  <td className="py-2.5 px-3 text-rose-600">R$ 2.500,00</td>
                  <td className="py-2.5 px-3 font-bold text-slate-900">R$ 37.300,00</td>
                  <td className="py-2.5 px-3 text-sky-700 font-bold">Em Auditoria</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
