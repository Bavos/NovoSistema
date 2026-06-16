import React, { useState, useEffect } from 'react';
import { useFirebase } from '../context/FirebaseContext';
import { Profissional, Agendamento, DocumentoAnexo } from '../types';
import { Plus, Edit2, Trash2, X, Check, CalendarDays, Paperclip, AlertCircle } from 'lucide-react';
import { db } from '../lib/firebase';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';

export const Profissionais: React.FC = () => {
  const { profissionais, addProfissional, updateProfissional, deleteProfissional, pacientes } = useFirebase();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProf, setEditingProf] = useState<Profissional | null>(null);
  const [activeTab, setActiveTab] = useState<'dados' | 'agenda'>('dados');
  const [agendamentosProf, setAgendamentosProf] = useState<Agendamento[]>([]);

  useEffect(() => {
    if (editingProf && activeTab === 'agenda') {
      const q = query(
        collection(db, 'agendamentos'),
        where('idProfissional', '==', editingProf.id),
        orderBy('data', 'asc')
      );
      
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const agList: Agendamento[] = [];
        snapshot.forEach(doc => {
          agList.push({ ...doc.data(), id: doc.id } as Agendamento);
        });
        setAgendamentosProf(agList);
      }, (err) => {
        console.error('Error fetching agendamentos for profissional:', err);
      });
      
      return () => unsubscribe();
    } else {
      setAgendamentosProf([]);
    }
  }, [editingProf, activeTab]);

  const [selectedDocs, setSelectedDocs] = useState<{ [key: string]: File | null }>({
    cracha: null,
    certificados: null,
    comprovanteResidencia: null,
    vacinas: null,
    outros: null,
  });

  const [formData, setFormData] = useState({
    nome: '',
    especialidade: '',
    telefone: '',
    foto: '',
    temMei: false,
    cnpj: '',
    sexo: '' as string,
    dataNascimento: '',
    idade: undefined as number | undefined,
    profissao: '' as string,
    rg: '',
    cpf: '',
    conselho: '',
    status: '' as string,
    ativo: true as boolean,
    dadosBancarios: {
        banco: '',
        agencia: '',
        conta: '',
        pix: ''
    },
    endereco: {
        rua: '',
        numero: '',
        cep: '',
        bairro: '',
        cidade: '',
        estado: ''
    },
    documentos: {
      cracha: '',
      certificados: '',
      comprovanteResidencia: '',
      vacinas: '',
      outros: ''
    },
    documentosAnexos: [] as DocumentoAnexo[]
  });

  // Calculate age based on dataNascimento
  useEffect(() => {
    if (formData.dataNascimento) {
      const today = new Date();
      const birthDate = new Date(formData.dataNascimento);
      if (!isNaN(birthDate.getTime())) {
        let calculatedAge = today.getFullYear() - birthDate.getFullYear();
        const m = today.getMonth() - birthDate.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
          calculatedAge--;
        }
        if (calculatedAge >= 0) {
          setFormData(prev => ({ ...prev, idade: calculatedAge }));
        }
      }
    }
  }, [formData.dataNascimento]);

  const handleOpenModal = (prof: Profissional | null = null, initialTab: 'dados' | 'agenda' = 'dados') => {
    setEditingProf(prof);
    setActiveTab(initialTab);
    setSelectedDocs({
      cracha: null,
      certificados: null,
      comprovanteResidencia: null,
      vacinas: null,
      outros: null,
    });
    setFormData(prof ? {
        nome: prof.nome || '',
        especialidade: prof.especialidade || '',
        telefone: prof.telefone || '',
        foto: prof.foto || '',
        temMei: prof.temMei ?? false,
        cnpj: prof.cnpj || '',
        sexo: prof.sexo || 'Masculino',
        dataNascimento: prof.dataNascimento || '',
        idade: prof.idade,
        profissao: prof.profissao || 'Cuidadora(o)',
        rg: prof.rg || '',
        cpf: prof.cpf || '',
        conselho: prof.conselho || '',
        status: prof.status || 'Ativo',
        ativo: prof.ativo ?? (prof.status === 'Ativo'),
        dadosBancarios: prof.dadosBancarios || { banco: '', agencia: '', conta: '', pix: '' },
        endereco: prof.endereco ? {
          rua: prof.endereco.rua || '',
          numero: prof.endereco.numero || '',
          cep: prof.endereco.cep || '',
          bairro: prof.endereco.bairro || '',
          cidade: prof.endereco.cidade || '',
          estado: prof.endereco.estado || ''
        } : { rua: '', numero: '', cep: '', bairro: '', cidade: '', estado: '' },
        documentos: prof.documentos || {
          cracha: '',
          certificados: '',
          comprovanteResidencia: '',
          vacinas: '',
          outros: ''
        },
        documentosAnexos: prof.documentosAnexos || []
    } : {
        nome: '',
        especialidade: '',
        telefone: '',
        foto: '',
        temMei: false,
        cnpj: '',
        sexo: '',
        dataNascimento: '',
        idade: undefined,
        profissao: '',
        rg: '',
        cpf: '',
        conselho: '',
        status: '',
        ativo: true,
        dadosBancarios: { banco: '', agencia: '', conta: '', pix: '' },
        endereco: { rua: '', numero: '', cep: '', bairro: '', cidade: '', estado: '' },
        documentos: {
          cracha: '',
          certificados: '',
          comprovanteResidencia: '',
          vacinas: '',
          outros: ''
        },
        documentosAnexos: []
    });
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCpfVal = (formData.cpf || '').replace(/\D/g, '');
    if (cleanCpfVal.length !== 11) {
      return; // Block save if CPF is incomplete
    }

    const finalData = {
      ...formData,
      especialidade: formData.profissao // Align speciality with profession
    };
    if (editingProf) {
      await updateProfissional({ ...editingProf, ...finalData });
    } else {
      await addProfissional(finalData);
    }
    setIsModalOpen(false);
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({ ...prev, foto: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const addDocumentoAnexoRow = () => {
    const newDoc: DocumentoAnexo = {
      id: Date.now() + Math.random().toString(36).substring(2, 9),
      tipo: 'Crachá',
      arquivo: null,
      nomeArquivo: ''
    };
    setFormData(prev => ({
      ...prev,
      documentosAnexos: [...(prev.documentosAnexos || []), newDoc]
    }));
  };

  const removeDocumentoAnexoRow = (id: string | number) => {
    setFormData(prev => ({
      ...prev,
      documentosAnexos: (prev.documentosAnexos || []).filter(doc => doc.id !== id)
    }));
  };

  const updateDocumentoAnexoRow = (id: string | number, field: keyof DocumentoAnexo, value: any) => {
    setFormData(prev => ({
      ...prev,
      documentosAnexos: (prev.documentosAnexos || []).map(doc =>
        doc.id === id ? { ...doc, [field]: value } : doc
      )
    }));
  };

  const handleDocumentoFileChange = (id: string | number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({
          ...prev,
          documentosAnexos: (prev.documentosAnexos || []).map(doc =>
            doc.id === id ? { ...doc, arquivo: reader.result as string, nomeArquivo: file.name } : doc
          )
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-200">
        <h2 className="text-sm font-bold text-slate-800">Gerenciamento de Profissionais</h2>
        <button
          onClick={() => handleOpenModal()}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 flex items-center gap-2"
        >
          <Plus size={14} /> Novo Profissional
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-md">
        <table className="w-full text-xs">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 text-[10px] font-semibold uppercase tracking-wider">
            <tr>
              <th className="p-3 text-left">Nome</th>
              <th className="p-3 text-left">Especialidade</th>
              <th className="p-3 text-left">Telefone</th>
              <th className="p-3 text-center">Status</th>
              <th className="p-3 text-center">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {(profissionais || []).map(prof => (
              <tr key={prof.id} className="hover:bg-slate-50 transition-colors duration-150">
                <td className="p-3 font-medium text-slate-800 text-left">{prof.nome}</td>
                <td className="p-3 text-slate-600 text-left">{prof.especialidade}</td>
                <td className="p-3 text-slate-600 text-left">{prof.telefone}</td>
                <td className="p-3 text-center">
                    <span className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-bold ${prof.status === 'Ativo' ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-red-100 text-red-700 border border-red-200'}`}>
                        {prof.status}
                    </span>
                </td>
                 <td className="p-3">
                  <div className="flex gap-2 justify-center items-center">
                    <button
                      onClick={() => handleOpenModal(prof, 'agenda')}
                      className="text-[#1a3c2e] bg-[#1a3c2e]/5 hover:bg-[#1a3c2e]/10 hover:text-[#1a3c2e] transition-colors px-2 py-1 rounded-lg border border-[#1a3c2e]/10 flex items-center gap-1 font-extrabold text-[10px] cursor-pointer"
                      title="Ver Agenda de Plantões"
                    >
                      <CalendarDays size={12} className="text-[#b8860b]" />
                      <span>Agenda</span>
                    </button>
                    <button onClick={() => handleOpenModal(prof, 'dados')} className="text-blue-600 hover:text-blue-850 hover:bg-blue-50 transition-all p-1.5 rounded-lg border border-transparent hover:border-blue-100" title="Editar"><Edit2 size={13} /></button>
                    <button onClick={() => deleteProfissional(prof.id)} className="text-red-600 hover:text-red-850 hover:bg-red-50 transition-all p-1.5 rounded-lg border border-transparent hover:border-red-100" title="Deletar"><Trash2 size={13} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 backdrop-blur-xs">
          <form onSubmit={handleSave} className="bg-white p-6 rounded-2xl w-full max-w-3xl space-y-5 max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-100">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <div className="flex flex-wrap items-center gap-3">
                <h3 className="font-extrabold text-[#1a3c2e] text-base sm:text-lg">
                  {editingProf ? 'Editar Cadastro de Profissional' : 'Novo Cadastro de Profissional'}
                </h3>
                <button
                  type="button"
                  onClick={() => {
                    const nextStatus = formData.status === 'Ativo' ? 'Inativo' : 'Ativo';
                    setFormData(prev => ({
                      ...prev,
                      status: nextStatus,
                      ativo: nextStatus === 'Ativo'
                    }));
                  }}
                  className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider transition-all border flex items-center gap-1.5 cursor-pointer shadow-xs ${
                    formData.status === 'Ativo'
                      ? 'bg-[#1a3c2e] text-[#b8860b] border-[#b8860b] hover:bg-[#1a3c2e]/90'
                      : 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${formData.status === 'Ativo' ? 'bg-[#b8860b]' : 'bg-rose-500'}`} />
                  {formData.status === 'Ativo' ? 'Ativo' : 'Inativo'}
                </button>
              </div>
              <button type="button" onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-50 transition-colors">
                <X size={18} />
              </button>
            </div>
            
            <div className="flex gap-4 border-b pb-1.5 mb-2">
              <button
                type="button"
                onClick={() => setActiveTab('dados')}
                className={`font-black pb-1.5 text-xs uppercase tracking-wider transition-colors border-b-2 ${
                  activeTab === 'dados'
                    ? 'border-[#1a3c2e] text-[#1a3c2e]'
                    : 'border-transparent text-slate-400 hover:text-slate-600'
                }`}
              >
                Dados Pessoais
              </button>
              {editingProf && (
                <button
                  type="button"
                  onClick={() => setActiveTab('agenda')}
                  className={`font-black pb-1.5 text-xs uppercase tracking-wider transition-colors flex items-center gap-1.5 flex-row border-b-2 ${
                    activeTab === 'agenda'
                      ? 'border-[#1a3c2e] text-[#1a3c2e]'
                      : 'border-transparent text-slate-400 hover:text-slate-600'
                  }`}
                >
                  <CalendarDays size={13} /> Agenda do Profissional
                </button>
              )}
            </div>

            {activeTab === 'dados' ? (
              <div className="space-y-6">
                {/* 1. Identification Section */}
                <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100 space-y-4">
                  <div className="border-l-4 border-[#b8860b] pl-3">
                    <h4 className="text-xs font-extrabold text-[#1a3c2e] uppercase tracking-wider">Identificação Profissional</h4>
                  </div>

                  <div className="flex flex-col md:flex-row gap-5 items-start">
                    {/* Photo Upload Container */}
                    <div className="flex flex-col items-center gap-2 self-center md:self-start bg-white p-3 rounded-xl border border-slate-200/60 shadow-sm">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Foto de Perfil</label>
                      <div className="relative w-24 h-24 rounded-full border-2 border-[#b8860b] overflow-hidden bg-slate-50 flex items-center justify-center group shadow-inner">
                        {formData.foto ? (
                          <img src={formData.foto} alt="Foto de Perfil" className="w-full h-full object-cover" />
                        ) : (
                          <div className="text-center p-2 text-slate-400 text-[10px] leading-tight font-black flex flex-col items-center">
                            <span>Sem Foto</span>
                            <span className="text-[8px] font-normal text-slate-500">(Carregar)</span>
                          </div>
                        )}
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handlePhotoChange}
                          className="absolute inset-0 opacity-0 cursor-pointer"
                          title="Carregar nova foto"
                        />
                      </div>
                      <span className="text-[10px] text-[#1a3c2e] font-extrabold cursor-pointer hover:underline relative">
                        Selecionar Imagem
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handlePhotoChange}
                          className="absolute inset-0 opacity-0 cursor-pointer"
                        />
                      </span>
                    </div>
                    
                    {/* Identification Inputs Grid */}
                    <div className="flex-1 w-full space-y-3">
                      <div>
                        <label className="text-[10px] font-bold text-slate-600 mb-1 block uppercase tracking-wider">Nome Completo</label>
                        <input
                          type="text"
                          placeholder="Digite o nome completo do profissional"
                          value={formData.nome}
                          onChange={e => setFormData({ ...formData, nome: e.target.value })}
                          className="w-full p-2 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-[#1a3c2e]/20 focus:border-[#1a3c2e] focus:outline-none placeholder:text-slate-400"
                          required
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="text-[10px] font-bold text-slate-600 mb-1 block uppercase tracking-wider">Profissão principal</label>
                          <select
                            value={formData.profissao}
                            onChange={e => setFormData({ ...formData, profissao: e.target.value as any })}
                            className="w-full p-2 border border-slate-200 rounded-lg text-xs bg-white focus:ring-2 focus:ring-[#1a3c2e]/20 focus:border-[#1a3c2e] focus:outline-none cursor-pointer text-slate-700 font-medium"
                            required
                          >
                            <option value="">Selecione...</option>
                            <option value="">Selecione...</option>
                            <option value="Cuidadora(o)">Cuidadora(o)</option>
                            <option value="Téc. Enfermagem">Téc. Enfermagem</option>
                            <option value="Enfermeira(o)">Enfermeira(o)</option>
                            <option value="Fisioterapeuta">Fisioterapeuta</option>
                            <option value="Médica(o)">Médica(o)</option>
                          </select>
                        </div>

                        <div>
                          <label className="text-[10px] font-bold text-slate-600 mb-1 block uppercase tracking-wider">Possui MEI?</label>
                          <div className="flex gap-2 items-center h-9">
                            <button
                              type="button"
                              onClick={() => setFormData({ ...formData, temMei: true })}
                              className={`px-3 py-1.5 rounded-lg text-[10px] font-extrabold transition-all cursor-pointer ${
                                formData.temMei 
                                  ? 'bg-[#1a3c2e] text-[#b8860b] border border-[#b8860b] shadow-sm' 
                                  : 'bg-slate-100 text-slate-600 border border-transparent hover:bg-slate-200'
                              }`}
                            >
                              Sim
                            </button>
                            <button
                              type="button"
                              onClick={() => setFormData({ ...formData, temMei: false })}
                              className={`px-3 py-1.5 rounded-lg text-[10px] font-extrabold transition-all cursor-pointer ${
                                !formData.temMei 
                                  ? 'bg-[#1a3c2e] text-[#b8860b] border border-[#b8860b] shadow-sm' 
                                  : 'bg-slate-100 text-slate-600 border border-transparent hover:bg-slate-200'
                              }`}
                            >
                              Não
                            </button>
                            
                            <div className="ml-2 flex-1 flex items-center">
                              {formData.temMei ? (
                                <input
                                  type="text"
                                  placeholder="Digite o CNPJ"
                                  value={formData.cnpj}
                                  onChange={e => setFormData({ ...formData, cnpj: e.target.value })}
                                  className="w-full p-1.5 border border-slate-250 rounded-lg text-[11px] focus:ring-1 focus:ring-[#1a3c2e] focus:outline-none"
                                  required
                                />
                              ) : (
                                <span className="text-[10px] text-slate-500 font-semibold uppercase">
                                  Cadastro MEI: <strong className="text-red-700 font-extrabold text-xs ml-1 uppercase">NÃO</strong>
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="text-[10px] font-bold text-slate-600 mb-1 block uppercase tracking-wider">Sexo</label>
                      <select
                        value={formData.sexo}
                        onChange={e => setFormData({ ...formData, sexo: e.target.value as any })}
                        className="w-full p-2 border border-slate-200 rounded-lg text-xs bg-white focus:ring-2 focus:ring-[#1a3c2e]/20 focus:border-[#1a3c2e] focus:outline-none cursor-pointer text-slate-700"
                        required
                      >
                        <option value="Masculino">Masculino</option>
                        <option value="Feminino">Feminino</option>
                        <option value="Outro">Outro</option>
                      </select>
                    </div>
                    
                    <div>
                      <label className="text-[10px] font-bold text-slate-600 mb-1 block uppercase tracking-wider">Data de Nascimento</label>
                      <input
                        type="date"
                        value={formData.dataNascimento}
                        onChange={e => setFormData({ ...formData, dataNascimento: e.target.value })}
                        className="w-full p-2 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-[#1a3c2e]/20 focus:border-[#1a3c2e] focus:outline-none cursor-pointer text-slate-700"
                        required
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-slate-600 mb-1 block uppercase tracking-wider">Idade Atual</label>
                      <div className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 flex items-center h-[34px] shadow-xs">
                        {formData.idade !== undefined ? `${formData.idade} anos` : <span className="text-slate-400 font-normal">Insira data de nascimento</span>}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. Documentation Section */}
                <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100 space-y-3">
                  <div className="border-l-4 border-[#b8860b] pl-3">
                    <h4 className="text-xs font-extrabold text-[#1a3c2e] uppercase tracking-wider">Documentação Legal</h4>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="text-[10px] font-bold text-slate-600 mb-1 block uppercase tracking-wider">RG</label>
                      <input
                        type="text"
                        placeholder="Identidade (Número/Órgão)"
                        value={formData.rg}
                        onChange={e => setFormData({ ...formData, rg: e.target.value })}
                        className="w-full p-2 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-[#1a3c2e]/20 focus:border-[#1a3c2e] focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-600 mb-1 block uppercase tracking-wider flex justify-between items-center">
                        <span>CPF <span className="text-red-600 font-extrabold">*</span></span>
                        {formData.cpf && (formData.cpf.replace(/\D/g, '').length !== 11) && (
                          <span className="text-red-500 font-bold normal-case text-[9px]">Incompleto (11 díg.)</span>
                        )}
                      </label>
                      <input
                        type="text"
                        placeholder="Digite o CPF"
                        value={formData.cpf}
                        onChange={e => {
                          const val = e.target.value.replace(/\D/g, '').slice(0, 11);
                          let formatted = val;
                          if (val.length > 3) formatted = val.slice(0, 3) + '.' + val.slice(3);
                          if (val.length > 6) formatted = formatted.slice(0, 7) + '.' + formatted.slice(7);
                          if (val.length > 9) formatted = formatted.slice(0, 11) + '-' + formatted.slice(11);
                          setFormData({ ...formData, cpf: formatted });
                        }}
                        className={`w-full p-2 border rounded-lg text-xs focus:ring-2 focus:outline-none transition-all ${
                          formData.cpf && (formData.cpf.replace(/\D/g, '').length !== 11)
                            ? 'border-red-300 focus:ring-red-200 focus:border-red-500 bg-red-50/10'
                            : 'border-slate-200 focus:ring-[#1a3c2e]/20 focus:border-[#1a3c2e]'
                        }`}
                        required
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-600 mb-1 block uppercase tracking-wider">Conselho Profissional</label>
                      <input
                        type="text"
                        placeholder="COREN, CRM, CREFITO etc."
                        value={formData.conselho}
                        onChange={e => setFormData({ ...formData, conselho: e.target.value })}
                        className="w-full p-2 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-[#1a3c2e]/20 focus:border-[#1a3c2e] focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* 3. Address and Contacts Section */}
                <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100 space-y-3">
                  <div className="border-l-4 border-[#b8860b] pl-3">
                    <h4 className="text-xs font-extrabold text-[#1a3c2e] uppercase tracking-wider">Contatos & Localização</h4>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-bold text-slate-600 mb-1 block uppercase tracking-wider">Telefone</label>
                      <input
                        type="text"
                        placeholder="Digite o telefone"
                        value={formData.telefone}
                        onChange={e => setFormData({ ...formData, telefone: e.target.value })}
                        className="w-full p-2 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-[#1a3c2e]/20 focus:border-[#1a3c2e] focus:outline-none"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 pt-1">
                    <div className="col-span-2">
                      <label className="text-[10px] font-bold text-slate-600 mb-1 block uppercase tracking-wider">CEP</label>
                      <input
                        type="text"
                        placeholder="Digite o CEP"
                        value={formData.endereco.cep}
                        onChange={e => setFormData({
                          ...formData,
                          endereco: { ...formData.endereco, cep: e.target.value }
                        })}
                        className="w-full p-2 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-[#1a3c2e]/20 focus:border-[#1a3c2e] focus:outline-none"
                      />
                    </div>
                    <div className="col-span-3">
                      <label className="text-[10px] font-bold text-slate-600 mb-1 block uppercase tracking-wider">Logradouro (Rua/Av.)</label>
                      <input
                        type="text"
                        placeholder="Informe o nome da rua"
                        value={formData.endereco.rua}
                        onChange={e => setFormData({
                          ...formData,
                          endereco: { ...formData.endereco, rua: e.target.value }
                        })}
                        className="w-full p-2 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-[#1a3c2e]/20 focus:border-[#1a3c2e] focus:outline-none"
                      />
                    </div>
                    <div className="col-span-1">
                      <label className="text-[10px] font-bold text-slate-600 mb-1 block uppercase tracking-wider">Nº</label>
                      <input
                        type="text"
                        placeholder="Digite o número"
                        value={formData.endereco.numero}
                        onChange={e => setFormData({
                          ...formData,
                          endereco: { ...formData.endereco, numero: e.target.value }
                        })}
                        className="w-full p-2 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-[#1a3c2e]/20 focus:border-[#1a3c2e] focus:outline-none"
                      />
                    </div>
                    
                    <div className="col-span-2">
                      <label className="text-[10px] font-bold text-slate-600 mb-1 block uppercase tracking-wider">Bairro</label>
                      <input
                        type="text"
                        placeholder="Informe o bairro"
                        value={formData.endereco.bairro}
                        onChange={e => setFormData({
                          ...formData,
                          endereco: { ...formData.endereco, bairro: e.target.value }
                        })}
                        className="w-full p-2 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-[#1a3c2e]/20 focus:border-[#1a3c2e] focus:outline-none"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="text-[10px] font-bold text-slate-600 mb-1 block uppercase tracking-wider">Cidade</label>
                      <input
                        type="text"
                        placeholder="Informe a cidade"
                        value={formData.endereco.cidade}
                        onChange={e => setFormData({
                          ...formData,
                          endereco: { ...formData.endereco, cidade: e.target.value }
                        })}
                        className="w-full p-2 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-[#1a3c2e]/20 focus:border-[#1a3c2e] focus:outline-none"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="text-[10px] font-bold text-slate-600 mb-1 block uppercase tracking-wider">Estado (UF)</label>
                      <input
                        type="text"
                        placeholder="Ex: SP"
                        value={formData.endereco.estado}
                        onChange={e => setFormData({
                          ...formData,
                          endereco: { ...formData.endereco, estado: e.target.value }
                        })}
                        className="w-full p-2 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-[#1a3c2e]/20 focus:border-[#1a3c2e] focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* 4. Bank Information Section */}
                <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100 space-y-3">
                  <div className="border-l-4 border-[#b8860b] pl-3">
                    <h4 className="text-xs font-extrabold text-[#1a3c2e] uppercase tracking-wider">Informações Financeiras</h4>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-bold text-slate-600 mb-1 block uppercase tracking-wider">Banco</label>
                      <input
                        type="text"
                        placeholder="Informe o banco"
                        value={formData.dadosBancarios.banco}
                        onChange={e => setFormData({...formData, dadosBancarios: {...formData.dadosBancarios, banco: e.target.value}})}
                        className="w-full p-2 border border-slate-200 rounded-lg text-xs pb-2 focus:ring-2 focus:ring-[#1a3c2e]/20 focus:outline-[#1a3c2e]"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-600 mb-1 block uppercase tracking-wider">Agência</label>
                      <input
                        type="text"
                        placeholder="Digite a agência"
                        value={formData.dadosBancarios.agencia}
                        onChange={e => setFormData({...formData, dadosBancarios: {...formData.dadosBancarios, agencia: e.target.value}})}
                        className="w-full p-2 border border-slate-200 rounded-lg text-xs pb-2 focus:ring-2 focus:ring-[#1a3c2e]/20 focus:outline-[#1a3c2e]"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-600 mb-1 block uppercase tracking-wider">Conta Corrente / Poupança</label>
                      <input
                        type="text"
                        placeholder="Digite a conta"
                        value={formData.dadosBancarios.conta}
                        onChange={e => setFormData({...formData, dadosBancarios: {...formData.dadosBancarios, conta: e.target.value}})}
                        className="w-full p-2 border border-slate-200 rounded-lg text-xs pb-2 focus:ring-2 focus:ring-[#1a3c2e]/20 focus:outline-[#1a3c2e]"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-600 mb-1 block uppercase tracking-wider">Chave PIX</label>
                      <input
                        type="text"
                        placeholder="Digite a chave PIX"
                        value={formData.dadosBancarios.pix}
                        onChange={e => setFormData({...formData, dadosBancarios: {...formData.dadosBancarios, pix: e.target.value}})}
                        className="w-full p-2 border border-slate-200 rounded-lg text-xs pb-2 focus:ring-2 focus:ring-[#1a3c2e]/20 focus:outline-[#1a3c2e]"
                      />
                    </div>
                  </div>
                </div>

                {/* 5. Document Management Section */}
                <div className="bg-slate-50/50 p-5 rounded-xl border border-slate-100 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-l-4 border-[#b8860b] pl-3">
                    <div>
                      <h4 className="text-xs font-extrabold text-[#1a3c2e] uppercase tracking-wider">Gestão de Documentos (Anexos)</h4>
                      <p className="text-[10px] text-slate-500 font-medium">Anexe e configure múltiplos documentos de forma dinâmica.</p>
                    </div>
                    <button
                      type="button"
                      onClick={addDocumentoAnexoRow}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#1a3c2e] hover:bg-[#1a3c2e]/90 text-[#b8860b] border border-[#b8860b] text-[10px] font-black uppercase tracking-wider rounded-lg shadow-xs transition-all cursor-pointer self-start sm:self-center"
                    >
                      <Plus size={14} /> Adicionar Novo Documento
                    </button>
                  </div>

                  {(!formData.documentosAnexos || formData.documentosAnexos.length === 0) ? (
                    <div className="text-center py-6 bg-white border border-dashed border-slate-200 rounded-xl">
                      <Paperclip size={20} className="mx-auto text-slate-400 mb-1" />
                      <p className="text-[10px] font-bold text-slate-600">Nenhum documento anexado ainda</p>
                      <p className="text-[9px] text-slate-400">Clique em "+ Adicionar Novo Documento" para começar.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {(formData.documentosAnexos || []).map((doc) => (
                        <div key={doc.id} className="grid grid-cols-1 sm:grid-cols-12 gap-3 bg-white p-3 rounded-xl border border-slate-200/80 shadow-xs hover:border-[#b8860b]/30 transition-all items-center">
                          
                          {/* Col 1: Dropdown selection */}
                          <div className="sm:col-span-6 space-y-1">
                            <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">Tipo de Documento</label>
                            <select
                              value={doc.tipo}
                              disabled={!!doc.arquivo}
                              onChange={(e) => updateDocumentoAnexoRow(doc.id, 'tipo', e.target.value)}
                              className={`w-full p-2 border border-slate-200 rounded-lg text-xs font-semibold focus:ring-1 focus:outline-none ${
                                doc.arquivo
                                  ? 'bg-gray-100 text-gray-500 cursor-not-allowed border-slate-200'
                                  : 'focus:ring-2 focus:ring-[#1a3c2e]/20 focus:border-[#1a3c2e] bg-slate-50/55 text-slate-700'
                              }`}
                            >
                              <option value="Crachá">Crachá</option>
                              <option value="Certificados">Certificados</option>
                              <option value="Comprovante de Residência">Comprovante de Residência</option>
                              <option value="Vacinas">Vacinas</option>
                              <option value="Outros">Outros</option>
                            </select>
                          </div>

                          {/* Col 3: File Input Upload */}
                          <div className="sm:col-span-5 space-y-1">
                            <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">Arquivo</label>
                            <div className="flex items-center gap-2">
                              {doc.arquivo ? (
                                <div className="flex-1 min-w-0 bg-emerald-50 text-emerald-700 px-2 py-1.5 rounded-lg border border-emerald-150 text-[10px] font-medium truncate flex items-center gap-1.5">
                                  <Check size={14} className="text-emerald-600 shrink-0" />
                                  <span className="truncate">{doc.nomeArquivo || 'Documento Salvo'}</span>
                                </div>
                              ) : (
                                <div className="flex-1 bg-slate-100 text-slate-400 px-2 py-1.5 rounded-lg border border-dashed border-slate-200 text-[10px] font-bold uppercase tracking-wider text-center">
                                  Pendente
                                </div>
                              )}
                              
                              <label className="p-2 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-lg border border-slate-200 transition-all cursor-pointer flex items-center justify-center shrink-0">
                                <Paperclip size={14} />
                                <input
                                  type="file"
                                  accept=".pdf,.png,.jpg,.jpeg"
                                  onChange={(e) => handleDocumentoFileChange(doc.id, e)}
                                  className="hidden"
                                />
                              </label>
                            </div>
                          </div>

                          {/* Col 4: Action button (trash/remove) */}
                          <div className="sm:col-span-1 flex justify-end sm:justify-center pt-2 sm:pt-4">
                            <button
                              type="button"
                              onClick={() => removeDocumentoAnexoRow(doc.id)}
                              className="p-1.5 text-rose-600 hover:text-rose-850 hover:bg-rose-50 transition-all rounded-lg border border-transparent hover:border-rose-100 cursor-pointer"
                              title="Remover Documento"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>

                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {agendamentosProf.length === 0 ? (
                  <div className="bg-slate-50 p-6 rounded-lg border border-slate-200 text-center text-slate-500">
                    <CalendarDays size={24} className="mx-auto mb-2 text-slate-400" />
                    <p className="text-sm font-medium">Este profissional não possui plantões agendados no momento.</p>
                  </div>
                ) : (
                  <div className="max-h-64 overflow-y-auto border rounded-xl border-slate-200 bg-white">
                      <table className="w-full text-xs align-middle">
                         <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 shadow-sm z-10 text-slate-700 text-[10px] font-semibold uppercase tracking-wider">
                           <tr>
                             <th className="p-3 text-right">Data</th>
                             <th className="p-3 text-left">Paciente</th>
                             <th className="p-3 text-center">Horário</th>
                             <th className="p-3 text-left">Tipo de Plantão</th>
                             <th className="p-3 text-right">Valor a Receber</th>
                             <th className="p-3 text-center">Status</th>
                           </tr>
                         </thead>
                         <tbody className="divide-y divide-slate-100">
                           {agendamentosProf.map(ag => {
                              const pacienteNome = pacientes.find(p => p.id === ag.idPaciente)?.nome || 'Paciente não encontrado';
                              const baseRepasse = Number(ag.valorRepasse || 0);
                              const ajudaCusto = Number(ag.ajudaCusto || 0);
                              
                              let multiplier = 1.0;
                              if (ag.tipoDia === 'Feriado 20%') {
                                multiplier = 1.2;
                              } else if (ag.tipoDia === 'Feriado 50%') {
                                multiplier = 1.5;
                              }
                              
                              const totalReceber = (baseRepasse * multiplier) + ajudaCusto;
                              return (
                                <tr key={ag.id} className="hover:bg-slate-50 transition-colors">
                                  <td className="p-3 font-medium text-slate-800">{ag.data.split('-').reverse().join('/')}</td>
                                  <td className="p-3">{pacienteNome}</td>
                                  <td className="p-3 text-slate-500 font-mono text-[10px]">{ag.horario}</td>
                                  <td className="p-3">{ag.tipoDia || 'Normal'}</td>
                                  <td className="p-3 font-bold text-green-700">
                                    {totalReceber.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                  </td>
                                  <td className="p-3">
                                     <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                                       ag.status === 'Cancelado' ? 'bg-red-100 text-red-700 border border-red-200' 
                                       : ag.status === 'Concluido' ? 'bg-indigo-100 text-indigo-700 border border-indigo-200' 
                                       : 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                                     }`}>
                                       {ag.status}
                                     </span>
                                  </td>
                                </tr>
                              )
                           })}
                         </tbody>
                      </table>
                  </div>
                )}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 justify-between items-center pt-4 border-t border-slate-100 mt-2">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-5 py-2 hover:bg-gray-100 font-medium text-sm text-slate-600 rounded-lg transition-colors cursor-pointer w-full sm:w-auto">Cancelar / Fechar</button>
                {activeTab === 'dados' && (
                  <div className="flex flex-col sm:flex-row items-center gap-2.5 w-full sm:w-auto justify-end">
                    {formData.cpf.replace(/\D/g, '').length !== 11 && (
                      <span className="text-xs text-red-600 font-bold flex items-center gap-1 bg-red-50/50 px-2.5 py-1.5 rounded-lg border border-red-100 text-center justify-center">
                        <AlertCircle size={14} /> CPF incompleto ou vazio!
                      </span>
                    )}
                    <button 
                      type="submit" 
                      disabled={formData.cpf.replace(/\D/g, '').length !== 11}
                      className={`px-5 py-2 font-black text-sm rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer w-full sm:w-auto ${
                        formData.cpf.replace(/\D/g, '').length !== 11
                          ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed opacity-60'
                          : 'bg-[#1a3c2e] hover:bg-[#1a3c2e]/90 text-[#b8860b] border border-[#b8860b] shadow-md shadow-[#1a3c2e]/10'
                      }`}
                    >
                      <Check size={16} /> Salvar Cadastro
                    </button>
                  </div>
                )}
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
