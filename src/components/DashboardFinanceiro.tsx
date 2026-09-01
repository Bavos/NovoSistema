import React, { useState } from "react";
import { useFaturas } from "../hooks/useFaturas";
import { Fatura } from "../types/fatura";

interface DashboardFinanceiroProps {
  initialSubTab?: string;
}

export function DashboardFinanceiro({ initialSubTab }: DashboardFinanceiroProps) {
  const { faturas, loading, error, emitirBoletoNoInter } = useFaturas();
  const [emitindoId, setEmitindoId] = useState<string | null>(null);
  const [msgSucesso, setMsgSucesso] = useState<string | null>(null);
  const [msgErro, setMsgErro] = useState<string | null>(null);

  const handleEmitirBoleto = async (fatura: Fatura) => {
    if (!fatura.id) return;
    setEmitindoId(fatura.id);
    setMsgSucesso(null);
    setMsgErro(null);

    try {
      const res: any = await emitirBoletoNoInter(fatura);
      setMsgSucesso(`Boleto e Pix gerados com sucesso! Nosso Número: ${res.nossoNumero || res.codigoSolicitacao}`);
    } catch (err: any) {
      console.error("Erro na emissão:", err);
      setMsgErro(err.message || "Falha na comunicação com o Banco Inter.");
    } finally {
      setEmitindoId(null);
    }
  };

  const copiarTexto = (texto: string, label: string) => {
    navigator.clipboard.writeText(texto);
    alert(`${label} copiado com sucesso!`);
  };

  if (loading) {
    return <div className="p-6 text-slate-500">Carregando painel financeiro...</div>;
  }

  if (error) {
    return <div className="p-6 text-red-500">Erro ao carregar dados: {error}</div>;
  }

  const totalFaturado = faturas.reduce((acc, f) => acc + (f.valor || 0), 0);
  const totalRecebido = faturas
    .filter((f) => f.status === "pago")
    .reduce((acc, f) => acc + (f.valor || 0), 0);
  const totalPendente = faturas
    .filter((f) => f.status === "pendente")
    .reduce((acc, f) => acc + (f.valor || 0), 0);

  return (
    <div className="space-y-6">
      {msgSucesso && (
        <div className="p-4 bg-green-50 border border-green-200 text-green-800 rounded flex justify-between items-center shadow-sm">
          <span>✔ {msgSucesso}</span>
          <button onClick={() => setMsgSucesso(null)} className="text-green-700 font-bold ml-4">✕</button>
        </div>
      )}
      {msgErro && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-800 rounded flex justify-between items-center shadow-sm">
          <span>❌ {msgErro}</span>
          <button onClick={() => setMsgErro(null)} className="text-red-700 font-bold ml-4">✕</button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 bg-white rounded shadow border border-slate-100">
          <p className="text-sm text-gray-500">Total Faturado</p>
          <p className="text-2xl font-bold">R$ {totalFaturado.toFixed(2)}</p>
        </div>
        <div className="p-4 bg-white rounded shadow border border-slate-100">
          <p className="text-sm text-gray-500">Total Recebido</p>
          <p className="text-2xl font-bold text-green-600">R$ {totalRecebido.toFixed(2)}</p>
        </div>
        <div className="p-4 bg-white rounded shadow border border-slate-100">
          <p className="text-sm text-gray-500">Total Pendente</p>
          <p className="text-2xl font-bold text-amber-600">R$ {totalPendente.toFixed(2)}</p>
        </div>
      </div>

      <div className="bg-white rounded shadow p-4 border border-slate-100">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">Faturas e Cobranças (Banco Inter)</h2>
        </div>

        {faturas.length === 0 ? (
          <p className="text-gray-400 py-6 text-center">Nenhuma fatura cadastrada no momento.</p>
        ) : (
          <ul className="divide-y divide-gray-200">
            {faturas.map((fatura) => {
              const estaEmitido = Boolean(fatura.linhaDigitavel || fatura.nossoNumero);
              const estaCarregando = emitindoId === fatura.id;

              return (
                <li key={fatura.id} className="py-4 flex flex-col md:flex-row justify-between md:items-center gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-slate-800">{fatura.clienteNome}</p>
                      {fatura.clienteDocumento && (
                        <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                          Doc: {fatura.clienteDocumento}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500">
                      Vencimento: <span className="font-medium text-slate-700">{fatura.dataVencimento}</span> • Valor: <span className="font-bold text-slate-800">R$ {fatura.valor?.toFixed(2)}</span>
                    </p>
                    {fatura.descricao && (
                      <p className="text-xs text-gray-400 mt-0.5">{fatura.descricao}</p>
                    )}

                    {estaEmitido && (
                      <div className="mt-2 flex flex-wrap gap-2 text-xs">
                        {fatura.nossoNumero && (
                          <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded border border-blue-100">
                            Nosso Nº: {fatura.nossoNumero}
                          </span>
                        )}
                        {fatura.linhaDigitavel && (
                          <button
                            onClick={() => copiarTexto(fatura.linhaDigitavel!, "Linha Digitável")}
                            className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-2 py-1 rounded border border-slate-300"
                          >
                            📋 Copiar Linha Digitável
                          </button>
                        )}
                        {fatura.pixCopiaECola && (
                          <button
                            onClick={() => copiarTexto(fatura.pixCopiaECola!, "Código Pix")}
                            className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 px-2 py-1 rounded border border-emerald-200"
                          >
                            ⚡ Copiar Pix
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-3 self-end md:self-center">
                    <span className={`text-xs px-2.5 py-1 font-semibold rounded ${
                      fatura.status === "pago"
                        ? "bg-green-100 text-green-700"
                        : fatura.status === "vencido"
                        ? "bg-red-100 text-red-700"
                        : "bg-amber-100 text-amber-800"
                    }`}>
                      {fatura.status.toUpperCase()}
                    </span>

                    {!estaEmitido ? (
                      <button
                        onClick={() => handleEmitirBoleto(fatura)}
                        disabled={estaCarregando}
                        className="bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold px-3 py-2 rounded shadow transition disabled:opacity-50"
                      >
                        {estaCarregando ? "Emitindo no Inter..." : "Emitir Boleto Inter"}
                      </button>
                    ) : (
                      <span className="text-xs text-emerald-600 font-medium flex items-center gap-1 bg-emerald-50 px-2 py-1 rounded border border-emerald-200">
                        ✔ Registrado
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

export default DashboardFinanceiro;
