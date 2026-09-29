import React, { useState } from "react";
import { useFaturas } from "../hooks/useFaturas";
import { Fatura } from "../types/fatura";
import { mascaraCPF, mascaraCNPJ, getSugestaoVencimento } from "../lib/masks";
import { downloadBoletoPdf } from "../services/interService";
import { toast } from "react-hot-toast";

interface DashboardFinanceiroProps {
  initialSubTab?: string;
}

export function DashboardFinanceiro({ initialSubTab }: DashboardFinanceiroProps) {
  const { faturas, loading, error, emitirBoletoNoInter } = useFaturas();
  const [emitindoId, setEmitindoId] = useState<string | null>(null);
  const [msgSucesso, setMsgSucesso] = useState<string | null>(null);
  const [msgErro, setMsgErro] = useState<string | null>(null);
  const [copiedLinhaMap, setCopiedLinhaMap] = useState<Record<string, boolean>>({});
  const [copiedPixMap, setCopiedPixMap] = useState<Record<string, boolean>>({});

  // States para Modal de Confirmação Rápida Pré-Disparo
  const [faturaParaEmitir, setFaturaParaEmitir] = useState<Fatura | null>(null);
  const [docModalInput, setDocModalInput] = useState<string>("");
  const [vencimentoModalInput, setVencimentoModalInput] = useState<string>("");

  const handleAbrirModalConfirmacao = (fatura: Fatura) => {
    setMsgSucesso(null);
    setMsgErro(null);

    const cleanDoc = (fatura.clienteDocumento || "").replace(/\D/g, "");
    setDocModalInput(cleanDoc.length > 11 ? mascaraCNPJ(cleanDoc) : mascaraCPF(cleanDoc));

    const hojeIso = new Date().toISOString().split("T")[0];
    const venc = fatura.dataVencimento && fatura.dataVencimento >= hojeIso
      ? fatura.dataVencimento
      : getSugestaoVencimento();

    setVencimentoModalInput(venc);
    setFaturaParaEmitir(fatura);
  };

  const handleConfirmarEmitirBoleto = async () => {
    if (!faturaParaEmitir || !faturaParaEmitir.id) return;

    const cleanDoc = docModalInput.replace(/\D/g, "");
    if (!cleanDoc || cleanDoc.length < 11) {
      setMsgErro("CPF/CNPJ do pagador é obrigatório para emissão do boleto (mínimo 11 dígitos).");
      return;
    }

    const hojeIso = new Date().toISOString().split("T")[0];
    if (!vencimentoModalInput || vencimentoModalInput < hojeIso) {
      setMsgErro("Data de Vencimento é obrigatória e deve ser hoje ou posterior.");
      return;
    }

    const faturaAtualizada: Fatura = {
      ...faturaParaEmitir,
      clienteDocumento: cleanDoc,
      dataVencimento: vencimentoModalInput,
    };

    const targetId = faturaParaEmitir.id;
    setFaturaParaEmitir(null);
    setEmitindoId(targetId);
    setMsgSucesso(null);
    setMsgErro(null);

    try {
      const res: any = await emitirBoletoNoInter(faturaAtualizada);
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
    toast.success(`${label} copiado com sucesso!`);
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
              const cobranca = (fatura as any).cobrancaInter;
              const nossoNum = cobranca?.nossoNumero || fatura.nossoNumero;
              const linhaDig = cobranca?.linhaDigitavel || fatura.linhaDigitavel;
              const pixCopia = cobranca?.pixCopiaECola || fatura.pixCopiaECola;
              const pdfBase = cobranca?.pdfBase64 || (fatura as any).pdfBase64;
              const codSolic = cobranca?.codigoSolicitacao || (fatura as any).codigoSolicitacao;
              const estaEmitido = Boolean(linhaDig || nossoNum || codSolic || cobranca?.status === "EMITIDO");
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
                        {nossoNum && (
                          <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded border border-blue-100 font-mono">
                            Nosso Nº: {nossoNum}
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => downloadBoletoPdf(pdfBase, nossoNum || fatura.id, codSolic)}
                          className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-bold shadow-2xs transition-all cursor-pointer flex items-center gap-1 active:scale-95"
                          title="Baixar Boleto Oficial em PDF"
                        >
                          <span>📥</span> Baixar Boleto (PDF)
                        </button>
                        {linhaDig && (
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(linhaDig);
                              setCopiedLinhaMap(prev => ({ ...prev, [fatura.id!]: true }));
                              toast.success("Linha digitável copiada!");
                              setTimeout(() => setCopiedLinhaMap(prev => ({ ...prev, [fatura.id!]: false })), 2500);
                            }}
                            className={`px-2.5 py-1 text-xs font-bold rounded shadow-2xs transition-all cursor-pointer flex items-center gap-1 active:scale-95 ${
                              copiedLinhaMap[fatura.id!]
                                ? 'bg-blue-800 text-white'
                                : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300'
                            }`}
                            title="Copiar Linha Digitável do Boleto"
                          >
                            <span>{copiedLinhaMap[fatura.id!] ? "✓" : "📋"}</span>
                            <span>{copiedLinhaMap[fatura.id!] ? "Copiado!" : "Copiar Linha Digitável"}</span>
                          </button>
                        )}
                        {pixCopia && (
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(pixCopia);
                              setCopiedPixMap(prev => ({ ...prev, [fatura.id!]: true }));
                              toast.success("Pix Copia e Cola copiado!");
                              setTimeout(() => setCopiedPixMap(prev => ({ ...prev, [fatura.id!]: false })), 2500);
                            }}
                            className={`px-2.5 py-1 text-xs font-bold rounded shadow-2xs transition-all cursor-pointer flex items-center gap-1 active:scale-95 ${
                              copiedPixMap[fatura.id!]
                                ? 'bg-teal-800 text-white'
                                : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200'
                            }`}
                            title="Copiar Pix Copia e Cola"
                          >
                            <span>{copiedPixMap[fatura.id!] ? "✓" : "⚡"}</span>
                            <span>{copiedPixMap[fatura.id!] ? "Copiado!" : "Copiar Pix"}</span>
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
                        onClick={() => handleAbrirModalConfirmacao(fatura)}
                        disabled={estaCarregando}
                        className="bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold px-3 py-2 rounded shadow transition disabled:opacity-50 cursor-pointer"
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

      {/* Modal de Confirmação Rápida Pré-Disparo - Dashboard Financeiro */}
      {faturaParaEmitir && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4 animate-in fade-in-20 font-sans">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl p-6 max-w-lg w-full space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <span>🧾 Conferência de Emissão de Boleto - Banco Inter</span>
              </h3>
              <button
                type="button"
                onClick={() => setFaturaParaEmitir(null)}
                className="text-slate-400 hover:text-slate-700 font-bold text-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Confira os dados da fatura e preencha os campos obrigatórios abaixo antes de realizar a emissão oficial na API v3 do Banco Inter:
            </p>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3 text-xs">
              <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                <span className="font-bold text-slate-500">Pagador:</span>
                <span className="font-bold text-slate-900 text-right">{faturaParaEmitir.clienteNome}</span>
              </div>

              <div>
                <label className="block font-bold text-slate-600 mb-1">
                  Documento (CPF / CNPJ) *
                </label>
                <input
                  type="text"
                  placeholder="000.000.000-00 ou 00.000.000/0000-00"
                  value={docModalInput}
                  onChange={(e) => {
                    const clean = e.target.value.replace(/\D/g, "");
                    setDocModalInput(clean.length > 11 ? mascaraCNPJ(clean) : mascaraCPF(clean));
                  }}
                  className={`w-full p-2 border rounded-lg text-xs font-mono ${
                    (!docModalInput || docModalInput.replace(/\D/g, "").length < 11)
                      ? "border-amber-400 bg-amber-50/70 text-amber-950 font-bold"
                      : "border-slate-200 bg-white"
                  }`}
                />
                {(!docModalInput || docModalInput.replace(/\D/g, "").length < 11) && (
                  <p className="text-[11px] font-bold text-amber-800 mt-1">
                    ⚠️ CPF/CNPJ obrigatório para registro de boleto
                  </p>
                )}
              </div>

              <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                <span className="font-bold text-slate-500">Competência / Emissão:</span>
                <span className="font-bold text-slate-800">
                  {faturaParaEmitir.dataEmissao ? faturaParaEmitir.dataEmissao.substring(0, 10) : "Atual"}
                </span>
              </div>

              <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                <span className="font-bold text-slate-500">Valor Total:</span>
                <span className="font-mono font-extrabold text-emerald-700 text-sm">
                  R$ {(faturaParaEmitir.valor || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>

              <div>
                <label className="block font-bold text-slate-600 mb-1">
                  Data de Vencimento *
                </label>
                <input
                  type="date"
                  min={new Date().toISOString().split("T")[0]}
                  value={vencimentoModalInput}
                  onChange={(e) => setVencimentoModalInput(e.target.value)}
                  className={`w-full p-2 border rounded-lg text-xs font-mono ${
                    (!vencimentoModalInput || vencimentoModalInput < new Date().toISOString().split("T")[0])
                      ? "border-rose-400 bg-rose-50/70 text-rose-950 font-bold"
                      : "border-slate-200 bg-white"
                  }`}
                />
                {(!vencimentoModalInput || vencimentoModalInput < new Date().toISOString().split("T")[0]) && (
                  <p className="text-[11px] font-bold text-rose-800 mt-1">
                    ⚠️ Data de vencimento é obrigatória (hoje ou posterior)
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setFaturaParaEmitir(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors cursor-pointer"
              >
                Ajustar / Voltar
              </button>
              <button
                type="button"
                onClick={handleConfirmarEmitirBoleto}
                disabled={
                  !docModalInput ||
                  docModalInput.replace(/\D/g, "").length < 11 ||
                  !vencimentoModalInput ||
                  vencimentoModalInput < new Date().toISOString().split("T")[0]
                }
                className="px-5 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-md transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1.5"
              >
                <span>🧾 Confirmar e Emitir Boleto</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default DashboardFinanceiro;
