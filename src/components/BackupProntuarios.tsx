/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { useFirebase } from '../context/FirebaseContext';
import { db } from '../lib/firebase';
import { 
  collection, 
  query, 
  orderBy, 
  getDocs, 
  doc, 
  getDoc, 
  setDoc, 
  addDoc, 
  deleteDoc, 
  limit,
  Timestamp 
} from 'firebase/firestore';
import { 
  Database, 
  RefreshCw, 
  Download, 
  Clock, 
  Trash2, 
  Calendar, 
  Check, 
  ShieldCheck, 
  Info,
  AlertTriangle 
} from 'lucide-react';
import { Paciente } from '../types';

interface BackupRecord {
  id: string;
  timestamp: string;
  tipo: 'Automático' | 'Manual';
  itemsCount: number;
  dadosPacientes: string; // JSON string of patients array
  usuarioExecutou: string;
}

export const BackupProntuarios: React.FC = () => {
  const { user, userRole, setNotification } = useFirebase();
  const isAdmin = userRole?.toLowerCase() === 'administrador';

  const [backups, setBackups] = useState<BackupRecord[]>([]);
  const [intervalo, setIntervalo] = useState<'diario' | 'semanal' | 'mensal' | 'manual'>('semanal');
  const [loadingBackups, setLoadingBackups] = useState(true);
  const [isCreatingBackup, setIsCreatingBackup] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  // Load backups list & configuration on mount
  useEffect(() => {
    if (isAdmin) {
      fetchBackupsAndSettings();
    }
  }, [isAdmin]);

  const fetchBackupsAndSettings = async () => {
    setLoadingBackups(true);
    try {
      // 1. Fetch settings
      const settingsRef = doc(db, 'configs', 'backup_settings');
      const settingsSnap = await getDoc(settingsRef);
      let loadedInterval: 'diario' | 'semanal' | 'mensal' | 'manual' = 'semanal';

      if (settingsSnap.exists()) {
        const data = settingsSnap.data();
        if (data.intervalo) {
          loadedInterval = data.intervalo;
          setIntervalo(data.intervalo);
        }
      } else {
        // Create default settings if not exists
        await setDoc(settingsRef, { intervalo: 'semanal', updatedAt: new Date().toISOString() });
      }

      // 2. Fetch backups sorted by newest first
      const backupsColl = collection(db, 'backups_prontuarios');
      const q = query(backupsColl, orderBy('timestamp', 'desc'));
      const querySnap = await getDocs(q);
      const list: BackupRecord[] = [];

      querySnap.forEach((docSnap) => {
        const data = docSnap.data();
        list.push({
          id: docSnap.id,
          timestamp: data.timestamp,
          tipo: data.tipo,
          itemsCount: data.itemsCount,
          dadosPacientes: data.dadosPacientes,
          usuarioExecutou: data.usuarioExecutou,
        });
      });

      setBackups(list);

      // 3. Evaluate automatic periodic backup
      if (loadedInterval !== 'manual') {
        const lastBackup = list.find(b => b.tipo === 'Automático' || b.tipo === 'Manual');
        let shouldAutoBackup = false;

        if (!lastBackup) {
          shouldAutoBackup = true;
        } else {
          const lastTime = new Date(lastBackup.timestamp).getTime();
          const nowTime = new Date().getTime();
          const diffMs = nowTime - lastTime;
          const diffHours = diffMs / (1000 * 60 * 60);

          if (loadedInterval === 'diario' && diffHours >= 24) {
            shouldAutoBackup = true;
          } else if (loadedInterval === 'semanal' && diffHours >= 24 * 7) {
            shouldAutoBackup = true;
          } else if (loadedInterval === 'mensal' && diffHours >= 24 * 30) {
            shouldAutoBackup = true;
          }
        }

        if (shouldAutoBackup) {
          console.log('[Backup] Cron interval check resolved: running automatic backup...');
          await triggerBackup(true);
        }
      }
    } catch (err) {
      console.error('Erro ao buscar backups ou configurações:', err);
    } finally {
      setLoadingBackups(false);
    }
  };

  // Triggers backup creation
  const triggerBackup = async (isAutomatic: boolean = false) => {
    if (isCreatingBackup) return;
    setIsCreatingBackup(true);

    try {
      // Fetch latest list of patients directly from the collection to get real fresh values
      const patientsSnap = await getDocs(collection(db, 'pacientes'));
      const patientsArray: Paciente[] = [];

      patientsSnap.forEach(d => {
        patientsArray.push({ id: d.id, ...d.data() } as Paciente);
      });

      if (patientsArray.length === 0 && !isAutomatic) {
        alert('Nenhum prontuário de paciente foi localizado para salvar no backup.');
        setIsCreatingBackup(false);
        return;
      }

      const backupObj = {
        timestamp: new Date().toISOString(),
        tipo: (isAutomatic ? 'Automático' : 'Manual') as 'Automático' | 'Manual',
        itemsCount: patientsArray.length,
        dadosPacientes: JSON.stringify(patientsArray),
        usuarioExecutou: isAutomatic ? 'Sistema' : (user?.email || 'Administrador'),
      };

      // Create doc in Firestore
      const docRef = await addDoc(collection(db, 'backups_prontuarios'), backupObj);

      // Output to system logs too
      await addDoc(collection(db, 'logs_auditoria'), {
        timestamp: new Date().toISOString(),
        userId: user?.uid || 'sistema',
        action: 'CREATE',
        collection: 'backups_prontuarios',
        documentId: docRef.id,
        description: `Backup de segurança ${isAutomatic ? 'automático' : 'manual'} de todos os ${patientsArray.length} prontuários de pacientes gerado na nuvem.`
      });

      // Update state
      const newRecord: BackupRecord = {
        id: docRef.id,
        ...backupObj
      };

      setBackups(prev => [newRecord, ...prev]);
      setNotification(`Backup de prontuários em nuvem criado com sucesso! Documento ID: ${docRef.id}`);

      if (!isAutomatic) {
        alert(`Sucesso! Backup de segurança salvo na nuvem com ${patientsArray.length} prontuários incluídos.`);
      }
    } catch (err: any) {
      console.error('Erro ao gerar backup de prontuários:', err);
      if (!isAutomatic) {
        alert('Erro ao gerar backup: ' + (err.message || String(err)));
      }
    } finally {
      setIsCreatingBackup(false);
    }
  };

  // Save backup frequency settings
  const handleSaveSettings = async (selectedInterval: typeof intervalo) => {
    setIsSavingSettings(true);
    try {
      const settingsRef = doc(db, 'configs', 'backup_settings');
      await setDoc(settingsRef, { 
        intervalo: selectedInterval, 
        updatedAt: new Date().toISOString(),
        usuarioAlterou: user?.email || 'Administrador'
      }, { merge: true });

      setIntervalo(selectedInterval);
      setNotification(`Configuração de backup alterada para: ${
        selectedInterval === 'diario' ? 'Diário' :
        selectedInterval === 'semanal' ? 'Semanal' :
        selectedInterval === 'mensal' ? 'Mensal' : 'Desativado'
      }`);
      
      // Log setting update
      await addDoc(collection(db, 'logs_auditoria'), {
        timestamp: new Date().toISOString(),
        userId: user?.uid || 'admin',
        action: 'UPDATE',
        collection: 'configs',
        documentId: 'backup_settings',
        description: `Configuração de frequência de backup alterada para "${selectedInterval}" por ${user?.email || 'Administrador'}`
      });
      
    } catch (err: any) {
      alert('Erro ao salvar configurações de backup: ' + err.message);
    } finally {
      setIsSavingSettings(false);
    }
  };

  // Delete older backup
  const handleDeleteBackup = async (id: string) => {
    if (!window.confirm('Tem certeza de que deseja excluir este registro de backup do histórico técnico? Os dados guardados nesta data serão removidos.')) {
      return;
    }

    try {
      await deleteDoc(doc(db, 'backups_prontuarios', id));
      setBackups(prev => prev.filter(b => b.id !== id));
      setNotification('Registro de backup removido com sucesso.');

      // Audit Log
      await addDoc(collection(db, 'logs_auditoria'), {
        timestamp: new Date().toISOString(),
        userId: user?.uid || 'admin',
        action: 'DELETE',
        collection: 'backups_prontuarios',
        documentId: id,
        description: `Administrador excluiu o log de backup ID: ${id}`
      });
    } catch (err: any) {
      alert('Erro ao excluir backup: ' + err.message);
    }
  };

  // Downloads JSON
  const handleExportJSON = (record: BackupRecord) => {
    try {
      const dateFormatted = new Date(record.timestamp).toISOString().split('T')[0];
      const filename = `backup_prontuarios_${record.tipo.toLowerCase()}_${dateFormatted}.json`;
      
      // Format pretty JSON
      const parsedData = JSON.parse(record.dadosPacientes);
      const prettyJson = JSON.stringify(parsedData, null, 2);
      
      const blob = new Blob([prettyJson], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('Erro ao ler dados para exportação JSON.');
    }
  };

  // Downloads CSV matching Excel style
  const handleExportCSV = (record: BackupRecord) => {
    try {
      const parsedData: Paciente[] = JSON.parse(record.dadosPacientes);
      
      // Define CSV headers
      const headers = [
        'ID',
        'Nome',
        'Status',
        'CPF',
        'Data Nascimento',
        'Email',
        'Responsável',
        'Telefone Responsável',
        'Bairro',
        'Endereco_Rua',
        'Endereco_Numero',
        'Endereco_CEP',
        'Endereco_Bairro',
        'Endereco_Cidade',
        'Endereco_Estado',
        'Diagnostico_Principal',
        'Comorbidades',
        'Alergias',
        'Grau_Dependencia',
        'Plano_Atendimento_Tipo_Escala',
        'Plano_Convenio',
        'Plano_Matricula',
        'Pago_Por_Responsavel',
        'Criado_Em'
      ];

      // Build data rows
      const rows = parsedData.map(p => {
        const rua = p.endereco?.rua || '';
        const num = p.endereco?.numero || '';
        const cep = p.endereco?.cep || '';
        const bairroEnd = p.endereco?.bairro || '';
        const cidade = p.endereco?.cidade || '';
        const estado = p.endereco?.estado || '';
        
        const diag = p.informacoesMedicas?.diagnosticoPrincipal || '';
        const comorb = p.informacoesMedicas?.comorbidades || '';
        const alerg = p.informacoesMedicas?.alergias || '';
        const dep = p.informacoesMedicas?.grauDependencia || '';
        
        const planoEscala = p.planoAtendimento?.tipoEscala || '';
        const convenio = p.planoAtendimento?.convenio || '';
        const matricula = p.planoAtendimento?.matricula || '';
        const pagador = p.dadosPagamento?.responsavelPagamento || '';

        const fields = [
          p.id,
          p.nome,
          p.status,
          p.cpf,
          p.dataNascimento,
          p.email,
          p.nomeResponsavel,
          p.telefoneResponsavel,
          p.bairro,
          rua,
          num,
          cep,
          bairroEnd,
          cidade,
          estado,
          diag,
          comorb,
          alerg,
          dep,
          planoEscala,
          convenio,
          matricula,
          pagador,
          p.createdAt || ''
        ];

        // Escape double quotes and surround with quotes to preserve spacing
        return fields.map(f => {
          const str = String(f ?? '').replace(/"/g, '""');
          return `"${str}"`;
        }).join(';');
      });

      // Join headers and rows with semicolons (Brazilian / excel localized separator by default)
      const csvContent = [headers.join(';'), ...rows].join('\n');
      
      // Prepend Byte-Order Mark (BOM) for correct Portuguese accents display in Excel
      const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8' });
      const dateFormatted = new Date(record.timestamp).toISOString().split('T')[0];
      const filename = `backup_prontuarios_${record.tipo.toLowerCase()}_${dateFormatted}.csv`;
      
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('Erro ao converter dados para formato CSV.');
    }
  };

  const formatTimestamp = (isoStr: string) => {
    try {
      const d = new Date(isoStr);
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      const hours = String(d.getHours()).padStart(2, '0');
      const minutes = String(d.getMinutes()).padStart(2, '0');
      return `${day}/${month}/${year} às ${hours}:${minutes}`;
    } catch (e) {
      return isoStr;
    }
  };

  if (!isAdmin) {
    return (
      <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs text-slate-500">
        Painel restrito para administradores do sistema.
      </div>
    );
  }

  return (
    <div className="bg-white p-5 border border-slate-200 rounded-2xl shadow-sm space-y-5 animate-in fade-in-30" id="backup-prontuarios">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center space-x-2">
          <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg">
            <Database size={16} />
          </div>
          <div>
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-tight">Cuidado Domiciliar: Backup de Prontuários</h3>
            <p className="text-[10px] text-slate-400">Guarda periódica automatizada e manual das fichas clínicas na nuvem para contingência externa.</p>
          </div>
        </div>
        <div className="flex items-center space-x-1.5 text-[10px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full font-bold">
          <ShieldCheck size={11} />
          <span>Ativo / Criptografado</span>
        </div>
      </div>

      {/* Grid: Configurations vs Instant manual trigger */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
        {/* Settings Block */}
        <div className="bg-slate-50 p-4 border border-slate-200/90 rounded-xl space-y-3">
          <h4 className="font-bold text-slate-700 flex items-center gap-1">
            <span>⚙️ Frequência do Backup Automático</span>
          </h4>
          <p className="text-[11px] text-slate-500 leading-normal">
            Sempre que um Administrador acessar este painel, o sistema verificará se é necessário rodar o backup periódico e o fará de forma silenciosa e segura na nuvem.
          </p>
          <div className="flex items-center gap-2 pt-1">
            <select
              value={intervalo}
              onChange={(e) => handleSaveSettings(e.target.value as any)}
              disabled={isSavingSettings}
              className="p-1.5 border border-slate-200 rounded-lg text-xs bg-white text-slate-700 outline-none focus:ring-1 focus:ring-blue-500 flex-1 cursor-pointer"
            >
              <option value="diario">Diário (a cada 24 horas)</option>
              <option value="semanal">Semanal (a cada 7 dias - Recomendado)</option>
              <option value="mensal">Mensal (a cada 30 dias)</option>
              <option value="manual">Apenas Manual (Desativado)</option>
            </select>
            {isSavingSettings && <span className="text-[10px] text-slate-400 animate-pulse">Gravando...</span>}
          </div>
        </div>

        {/* Action Trigger Block */}
        <div className="bg-slate-50 p-4 border border-slate-200/90 rounded-xl flex flex-col justify-between">
          <div className="space-y-1.5">
            <h4 className="font-bold text-slate-700 flex items-center gap-1">
              <span>🚀 Forçar Backup Manual</span>
            </h4>
            <p className="text-[11px] text-slate-500 leading-normal">
              Gera e guarda imediatamente uma foto instantânea com o estado consolidado de todos os prontuários dos pacientes cadastrados e ativos no Firestore.
            </p>
          </div>
          <button
            onClick={() => triggerBackup(false)}
            disabled={isCreatingBackup}
            className="mt-3 w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-xs shadow-sm transition-all flex items-center justify-center gap-1.5 hover:scale-[1.01] cursor-pointer"
          >
            {isCreatingBackup ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Compactando e Enviando...</span>
              </>
            ) : (
              <>
                <Database size={13} />
                <span>Salvar Novo Backup de Segurança na Nuvem</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Backup Logs History */}
      <div className="space-y-2 text-xs">
        <h4 className="font-bold text-slate-700 flex items-center gap-1 border-b border-slate-50 pb-1.5">
          <Clock size={13} className="text-slate-400" />
          <span>Histórico de Proteções Realizadas ({backups.length})</span>
        </h4>

        {loadingBackups ? (
          <div className="flex items-center justify-center p-8 gap-2 bg-slate-50 rounded-xl border border-slate-100">
            <RefreshCw size={14} className="text-blue-500 animate-spin" />
            <span className="text-[11px] text-slate-400">Varrendo histórico de backups no Firestore...</span>
          </div>
        ) : backups.length === 0 ? (
          <div className="text-center p-8 bg-slate-50 border border-dashed border-slate-200 rounded-xl space-y-1">
            <p className="text-[11px] text-slate-500 italic">Nenhum registro de backup encontrado no histórico técnico.</p>
            <p className="text-[10px] text-slate-400">Clique no botão acima ou configure a frequência automática para começar.</p>
          </div>
        ) : (
          <div className="border border-slate-150 rounded-xl overflow-hidden divide-y divide-slate-100">
            {backups.map((bk) => (
              <div key={bk.id} className="flex flex-col sm:flex-row justify-between sm:items-center p-3 bg-white hover:bg-slate-50/50 transition-colors gap-2">
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-slate-800">{formatTimestamp(bk.timestamp)}</span>
                    <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold ${
                      bk.tipo === 'Automático' ? 'bg-indigo-50 text-indigo-700 border border-indigo-100' : 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                    }`}>
                      {bk.tipo}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-slate-400">
                    <span className="flex items-center gap-0.5">
                      <Calendar size={10} />
                      <span>{bk.itemsCount} registros de prontuários</span>
                    </span>
                    <span>•</span>
                    <span className="italic">Por: {bk.usuarioExecutou}</span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 self-end sm:self-auto">
                  <button
                    onClick={() => handleExportJSON(bk)}
                    className="p-1 px-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md font-bold text-[10px] flex items-center gap-1 cursor-pointer transition-colors"
                    title="Exportar dados para arquivo JSON"
                  >
                    <Download size={10} />
                    <span>Exportar JSON</span>
                  </button>
                  <button
                    onClick={() => handleExportCSV(bk)}
                    className="p-1 px-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-md font-bold text-[10px] flex items-center gap-1 cursor-pointer transition-colors"
                    title="Exportar tabela de prontuários para CSV"
                  >
                    <Download size={10} />
                    <span>Exportar CSV</span>
                  </button>
                  <button
                    onClick={() => handleDeleteBackup(bk.id)}
                    className="p-1 px-2 bg-red-50 hover:bg-red-100 text-red-600 hover:text-red-800 rounded-md cursor-pointer transition-colors"
                    title="Excluir do histórico"
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="text-[10px] text-slate-400 flex items-start gap-1 p-2.5 bg-yellow-50/40 border border-yellow-100 rounded-lg">
        <Info size={12} className="text-yellow-600 mt-0.5 shrink-0" />
        <p className="leading-relaxed">
          <strong>Segurança e Privacidade de Dados:</strong> O arquivo CSV exportado está configurado para incluir cabeçalhos estruturados e marca de ordem de byte UTF-8 (BOM), garantindo perfeita exibição de acentuação e caracteres especiais da língua portuguesa no Microsoft Excel, OpenOffice e Google Planilhas.
        </p>
      </div>
    </div>
  );
};
