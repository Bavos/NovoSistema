import React, { useState, useEffect, useRef } from 'react';
import html2canvas from 'html2canvas';
import { useFirebase } from '../context/FirebaseContext';
import { Profissional, Agendamento, DocumentoAnexo } from '../types';
import { Plus, Edit2, Trash2, X, Check, CalendarDays, Paperclip, AlertCircle, Printer, Download, FileImage } from 'lucide-react';
import { db, storage } from '../lib/firebase';
import { collection, query, where, orderBy, onSnapshot, doc, getDoc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { profissionalSchema } from '../schemas/validationSchemas';


export const Profissionais: React.FC = () => {
  const { profissionais, addProfissional, updateProfissional, deleteProfissional, uploadLogo, uploadProfissionalFoto, uploadPdf } = useFirebase();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [editingProf, setEditingProf] = useState<Profissional | null>(null);
  const [activeTab, setActiveTab] = useState<'dados' | 'agenda' | 'cracha'>('dados');
  const [agendamentosProf, setAgendamentosProf] = useState<Agendamento[]>([]);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Estados para documentos anexos reais (Storage + Firestore)
  const [tipoDocumentoAnexo, setTipoDocumentoAnexo] = useState<string>('');
  const [arquivoAnexo, setArquivoAnexo] = useState<File | null>(null);
  const [salvandoAnexo, setSalvandoAnexo] = useState<boolean>(false);
  const documentoInputRef = useRef<HTMLInputElement>(null);

  // Estado para titularidade de conta bancária (Sim/Não)
  const [isTitularConta, setIsTitularConta] = useState<string>('Sim');

  // Estado para visualização de documentos em modal
  const [previewDoc, setPreviewDoc] = useState<{ url: string; tipo: string; nome?: string } | null>(null);

  const isImageFile = (url: string, name?: string) => {
    const urlLower = (url || '').toLowerCase();
    const nameLower = (name || '').toLowerCase();
    return (
      urlLower.includes('.png') || urlLower.includes('.jpg') || urlLower.includes('.jpeg') || urlLower.includes('.gif') || urlLower.includes('.webp') || urlLower.includes('.svg') ||
      nameLower.endsWith('.png') || nameLower.endsWith('.jpg') || nameLower.endsWith('.jpeg') || nameLower.endsWith('.gif') || nameLower.endsWith('.webp') || nameLower.endsWith('.svg') ||
      urlLower.includes('image') || nameLower.startsWith('img-') || nameLower.includes('whatsapp')
    );
  };

  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => {
        setSuccessMessage(null);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

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
    documentosAnexos: [] as DocumentoAnexo[],
    nomeTitularConta: '',
    cpfTitularConta: '',
    grauParentescoTitular: '',
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

  const handleOpenModal = (prof: Profissional | null = null, initialTab: 'dados' | 'agenda' | 'cracha' = 'dados') => {
    setEditingProf(prof);
    setActiveTab(initialTab);
    
    // Resetar estados de anexo de documento
    setTipoDocumentoAnexo('');
    setArquivoAnexo(null);
    setSalvandoAnexo(false);
    if (documentoInputRef.current) {
      documentoInputRef.current.value = '';
    }

    // Definir estado de titularidade da conta
    setIsTitularConta(prof ? (prof.isTitularConta === 'Não' || prof.isTitularConta === false ? 'Não' : 'Sim') : 'Sim');
 
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
        documentosAnexos: prof.documentosAnexos || [],
        nomeTitularConta: prof.nomeTitularConta || '',
        cpfTitularConta: prof.cpfTitularConta || '',
        grauParentescoTitular: prof.grauParentescoTitular || '',
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
        documentosAnexos: [],
        nomeTitularConta: '',
        cpfTitularConta: '',
        grauParentescoTitular: '',
    });
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (uploading) {
      alert("Aguarde o upload dos arquivos finalizar.");
      return;
    }

    // Validação robusta com Zod
    const cleanCpfVal = (formData.cpf || '').replace(/\D/g, '');
    const validation = profissionalSchema.safeParse({ ...formData, cpf: cleanCpfVal });
    
    if (!validation.success) {
      alert(validation.error.issues[0].message);
      return;
    }

    setLoading(true); // O estado loading precisa ser definido no componente, adicionarei logo adiante

    try {
      const finalData = {
        ...formData,
        especialidade: formData.profissao,
        ativo: formData.status === 'Ativo',
        isTitularConta: isTitularConta === 'Sim' ? 'Sim' : 'Não',
        nomeTitularConta: isTitularConta === 'Não' ? formData.nomeTitularConta : '',
        cpfTitularConta: isTitularConta === 'Não' ? formData.cpfTitularConta : '',
        grauParentescoTitular: isTitularConta === 'Não' ? formData.grauParentescoTitular : ''
      };
      if (editingProf) {
        await updateProfissional({ ...editingProf, ...finalData });
        setSuccessMessage("Alterações do profissional salvas com sucesso!");
      } else {
        const addedProf = await addProfissional(finalData);
        setEditingProf(addedProf);
        setSuccessMessage("Novo profissional cadastrado com sucesso!");
      }
    } catch (err) {
      console.error("Erro ao salvar:", err);
      alert("Erro ao salvar profissional. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploading(true);
      try {
        const url = await uploadProfissionalFoto(file);
        setFormData(prev => ({ ...prev, foto: url }));
        setSuccessMessage("Foto do profissional enviada com sucesso!");
      } catch (err) {
        console.error("Erro ao subir foto:", err);
        alert("Erro ao enviar foto. Tente novamente.");
      } finally {
        setUploading(false);
      }
    }
  };

  const removeDocumentoAnexoRow = async (id: string | number) => {
    const updated = (formData.documentosAnexos || []).filter(doc => doc.id !== id);
    setFormData(prev => ({
      ...prev,
      documentosAnexos: updated
    }));

    if (editingProf) {
      try {
        const profRef = doc(db, 'profissionais', editingProf.id);
        await updateDoc(profRef, {
          documentosAnexos: updated
        });
        setSuccessMessage("Anexo removido com sucesso!");
      } catch (err) {
        console.error("Erro ao remover anexo do Firestore:", err);
      }
    }
  };

  const handleUploadAnexo = async () => {
    if (!editingProf) {
      alert("Por favor, salve o profissional primeiro para poder enviar documentos anexos.");
      return;
    }
    if (!arquivoAnexo) {
      alert("Selecione um arquivo primeiro.");
      return;
    }
    if (!tipoDocumentoAnexo) {
      alert("Por favor, selecione o Tipo de Documento.");
      return;
    }

    setSalvandoAnexo(true);

    try {
      const id = editingProf.id;
      // Fazer o upload para o Firebase Storage
      const pathRef = `profissionais/${id}/${arquivoAnexo.name}`;
      const storageRef = ref(storage, pathRef);
      
      const uploadResult = await uploadBytes(storageRef, arquivoAnexo);
      const downloadUrl = await getDownloadURL(uploadResult.ref);

      // Criar o objeto conforme especificado no requisito do usuário:
      // { url: downloadUrl, tipo: tipoDocumentoAnexo, nome: arquivo.name, data: new Date() }
      const novoAnexo = {
        id: `doc-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        tipo: tipoDocumentoAnexo,
        url: downloadUrl,
        arquivo: downloadUrl, // compatibilidade
        nome: arquivoAnexo.name,
        nomeArquivo: arquivoAnexo.name, // compatibilidade
        data: new Date().toISOString()
      };

      // Carregar os anexos existentes no formData
      const currentAnexos = formData.documentosAnexos || [];
      const updatedAnexos = [...currentAnexos, novoAnexo];

      // Atualizar o Firestore
      const profRef = doc(db, 'profissionais', id);
      await updateDoc(profRef, {
        documentosAnexos: updatedAnexos
      });

      // Atualizar o estado local
      setFormData(prev => ({
        ...prev,
        documentosAnexos: updatedAnexos
      }));

      // Limpar os campos do input
      setArquivoAnexo(null);
      setTipoDocumentoAnexo('');
      if (documentoInputRef.current) {
        documentoInputRef.current.value = '';
      }

      // Exiba o alerta de 'Salvo com sucesso' APENAS dentro do then do Firestore
      setSuccessMessage("Documento anexo salvo com sucesso!");

    } catch (err) {
      console.error("Erro no upload de documento real:", err);
      alert("Erro ao enviar documento. Tente novamente.");
    } finally {
      setSalvandoAnexo(false);
    }
  };

  const BadgeGerador = ({ profData }: { profData: Partial<Profissional> }) => {
    const badgeRef = useRef<HTMLDivElement>(null);
    const [loading, setLoading] = useState(false);
    const [config, setConfig] = useState<{logoUrl: string, razaoSocial: string, cnpj: string}>({logoUrl: '', razaoSocial: '', cnpj: ''});
    const [loadingConfig, setLoadingConfig] = useState(true);
    const [logoBase64, setLogoBase64] = useState<string>('');
    const [fotoBase64, setFotoBase64] = useState<string>('');

    // Safe utility to fetch any image url and convert it into a local Base64 string to prevent CORS canvas rendering failures
    const urlToBase64 = async (url: string): Promise<string> => {
      if (!url) return '';
      if (url.startsWith('data:')) return url;
      
      try {
        const response = await fetch(url);
        const blob = await response.blob();
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      } catch (err) {
        console.warn("[BadgeGerador] Failed to fetch convert image to Base64 via fetch, trying with Image element fallback:", err);
        return new Promise((resolve, reject) => {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.src = url;
          img.onload = () => {
            try {
              const canvas = document.createElement('canvas');
              canvas.width = img.width;
              canvas.height = img.height;
              const ctx = canvas.getContext('2d');
              ctx?.drawImage(img, 0, 0);
              resolve(canvas.toDataURL('image/png'));
            } catch (e) {
              reject(e);
            }
          };
          img.onerror = reject;
        });
      }
    };

    useEffect(() => {
      const fetchConfig = async () => {
        try {
          const docRef = doc(db, 'configuracoes_empresa', 'empresa');
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            setConfig(docSnap.data() as any);
          }
        } catch (err) {
          console.error("Erro ao buscar configurações:", err);
        } finally {
          setLoadingConfig(false);
        }
      };
      fetchConfig();
    }, []);

    // Load and convert both Logo and Profile photo to Base64 strings to preempt CORS exceptions in html2canvas
    useEffect(() => {
      const loadBase64Images = async () => {
        if (config.logoUrl) {
          try {
            const b64 = await urlToBase64(config.logoUrl);
            setLogoBase64(b64);
          } catch (e) {
            console.warn("Could not convert company logo to Base64:", e);
            setLogoBase64(config.logoUrl); // Fallback to raw url
          }
        } else {
          setLogoBase64('');
        }

        if (profData.foto) {
          try {
            const b64 = await urlToBase64(profData.foto);
            setFotoBase64(b64);
          } catch (e) {
            console.warn("Could not convert profile photo to Base64:", e);
            setFotoBase64(profData.foto); // Fallback to raw url
          }
        } else {
          setFotoBase64('');
        }
      };

      if (!loadingConfig) {
        loadBase64Images();
      }
    }, [config.logoUrl, profData.foto, loadingConfig]);

    const handleDownloadPng = async () => {
      setLoading(true);
      if (badgeRef.current) {
        try {
          console.log("[BadgeGerador] Starting html2canvas capture for PNG with onclone...");
          const canvas = await html2canvas(badgeRef.current, {
            scale: 2,
            useCORS: true,
            allowTaint: true,
            logging: false,
            backgroundColor: '#fcf8f2',
            onclone: (clonedDoc) => {
              const allElements = clonedDoc.getElementsByTagName('*');
              for (let i = 0; i < allElements.length; i++) {
                const el = allElements[i] as HTMLElement;
                const computedStyle = window.getComputedStyle(el);
                
                if (computedStyle.backgroundColor.includes('oklab') || computedStyle.backgroundColor.includes('oklch')) {
                  el.style.setProperty('background-color', '#fcf8f2', 'important');
                }
                if (computedStyle.color.includes('oklab') || computedStyle.color.includes('oklch')) {
                  el.style.setProperty('color', '#1a3c2e', 'important');
                }
                if (computedStyle.borderColor.includes('oklab') || computedStyle.borderColor.includes('oklch')) {
                  el.style.setProperty('border-color', '#b8860b', 'important');
                }
              }
            }
          });
          
          console.log("[BadgeGerador] Canvas generated successfully. Converting to PNG data URL.");
          const imgData = canvas.toDataURL('image/png');
          const link = document.createElement('a');
          link.href = imgData;
          link.download = `cracha_${profData.nome || 'profissional'}.png`;
          link.click();
          console.log("[BadgeGerador] PNG file downloaded.");
        } catch (err: any) {
          console.error("Erro ao gerar PNG:", err);
          alert(`Infelizmente erro ao gerar o arquivo PNG: ${err.message || String(err)}`);
        }
      } else {
        alert("Referência do elemento do crachá não encontrada.");
      }
      setLoading(false);
    };

    const handleDownloadWord = async () => {
      setLoading(true);
      if (badgeRef.current) {
        try {
          console.log("[BadgeGerador] Starting html2canvas capture with onclone...");
          const canvas = await html2canvas(badgeRef.current, {
            scale: 2,
            useCORS: true,
            allowTaint: true, // safe because we converted to base64 but can render other parts
            logging: false,
            backgroundColor: '#fcf8f2',
            onclone: (clonedDoc) => {
              try {
                const allElements = clonedDoc.getElementsByTagName('*');
                for (let i = 0; i < allElements.length; i++) {
                  const el = allElements[i] as HTMLElement;
                  const style = window.getComputedStyle(el);
                  if (!style) continue;
                  
                  if (style.backgroundColor && (style.backgroundColor.includes('oklab') || style.backgroundColor.includes('oklch'))) {
                    el.style.setProperty('background-color', '#fcf8f2', 'important');
                  }
                  if (style.color && (style.color.includes('oklab') || style.color.includes('oklch'))) {
                    el.style.setProperty('color', '#1a3c2e', 'important');
                  }
                  if (style.borderColor && (style.borderColor.includes('oklab') || style.borderColor.includes('oklch'))) {
                    el.style.setProperty('border-color', '#b8860b', 'important');
                  }
                }
              } catch (e) {
                console.warn("Erro ao higienizar oklab no clone", e);
              }
            }
          });
          
          console.log("[BadgeGerador] Canvas generated successfully. Converting to blob.");
          // JPEG format at 0.9 quality reduces payload to prevent parser failures or crash in mobile tools
          const imgData = canvas.toDataURL('image/jpeg', 0.9);
          
          const htmlStr = `
          <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
          <head>
            <meta charset="utf-8">
            <title>Crachá de Identidade</title>
          </head>
          <body style="background-color: #fcf8f2; text-align: center; margin: 0; padding: 0;">
            <img src="${imgData}" style="width: 100%; max-width: 800px; height: auto;" />
          </body>
          </html>`;
          
          const blob = new Blob(['\ufeff', htmlStr], { type: 'application/msword' });
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `cracha_${profData.nome || 'profissional'}.doc`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
          console.log("[BadgeGerador] Badge file triggered for download.");
        } catch (err: any) {
          console.error("Erro ao gerar Word:", err);
          alert(`Infelizmente erro ao gerar o arquivo de download: ${err.message || String(err)}\nPor favor tente novamente.`);
        }
      } else {
        alert("Referência do elemento do crachá não encontrada.");
      }
      setLoading(false);
    };

    return (
      <div className="space-y-4 p-4 print:p-0 print:m-0">
        <div className="flex flex-col items-center gap-2 print:hidden mb-4">
          <div className="flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={handleDownloadPng}
              disabled={loading || loadingConfig}
              className="px-6 py-2.5 bg-[#1a3c2e] text-[#b8860b] font-bold text-xs rounded-lg hover:opacity-90 transition-opacity flex items-center gap-2 disabled:bg-gray-400 cursor-pointer shadow-sm border border-[#b8860b]"
            >
              {loading ? 'Preparando...' : <><FileImage size={14} /> Baixar Crachá (Imagem PNG - Recomendado)</>}
            </button>
            <button
              type="button"
              onClick={handleDownloadWord}
              disabled={loading || loadingConfig}
              className="px-5 py-2.5 bg-slate-100 text-slate-700 font-bold text-xs rounded-lg hover:bg-slate-200 transition-colors flex items-center gap-2 disabled:bg-gray-400 cursor-pointer border border-slate-300"
            >
              {loading ? 'Carregando...' : <><Printer size={14} /> Baixar Crachá (Formato Word .doc)</>}
            </button>
          </div>
          <p className="text-[11px] text-slate-500 text-center max-w-lg mt-1">
            * <strong>Dispositivos móveis e tablets:</strong> Recomendamos baixar como <strong>Imagem PNG</strong>. O formato Word (.doc) pode ser marcado como corrompido neste dispositivo pois é um arquivo HTML disfarçado de documento.
          </p>
        </div>
        
        {/* We move ref={badgeRef} to the actual card container only, so downloading excludes the button and any surrounding non-badge UI elements */}
        <div className="flex flex-row gap-0 justify-center items-stretch print:flex-row print:gap-0 p-4 bg-[#fcf8f2] border-2 border-[#b8860b] rounded-xl shadow-sm divide-x divide-gray-200 w-[700px] h-[400px]" ref={badgeRef}>
          {/* Lado Esquerdo (Frente) */}
          <div className="w-1/2 p-6 flex flex-col items-center justify-between text-center">
             <div className="w-full flex justify-center mb-4">
                {loadingConfig ? (
                  <div className="w-32 h-16 bg-gray-100 animate-pulse rounded" />
                ) : logoBase64 ? (
                  <img src={logoBase64} alt="Logo" className="object-contain h-20 w-auto mix-blend-multiply" crossOrigin="anonymous" />
                ) : <div className="w-32 h-16 bg-gray-100 flex items-center justify-center text-[10px] text-gray-400">Sem Logo</div>}
             </div>
                
             <div className="flex-grow flex items-center justify-center">
                  <div className="w-32 h-40 object-cover rounded-sm border border-gray-300 overflow-hidden">
                      {fotoBase64 ? (
                        <img src={fotoBase64} alt="Foto" className="w-full h-full object-cover" crossOrigin="anonymous" />
                      ) : (
                        <div className="w-full h-full bg-gray-150 flex items-center justify-center text-slate-400 text-xs font-bold">Sem Foto</div>
                      )}
                  </div>
             </div>
             <div className="mt-4">
                <div className="font-bold text-lg text-slate-900">{profData.nome || "Nome do Profissional"}</div>
                <div className="text-sm text-slate-700 mt-1">{profData.profissao || "Profissão"}</div>
             </div>
          </div>
          
          {/* Lado Direito (Verso) */}
          <div className="w-1/2 p-6 flex flex-col justify-between">
             <div className="w-full">
               <table className="w-full text-left border-collapse">
                 <tbody>
                   <tr className="border-b border-slate-300">
                     <td className="py-2">
                        <div className="italic text-slate-500 text-xs">Nome</div>
                        <div className="text-sm font-semibold text-slate-800">{profData.nome}</div>
                     </td>
                   </tr>
                   <tr className="border-b border-slate-300">
                     <td className="py-2">
                        <div className="italic text-slate-500 text-xs">CPF</div>
                        <div className="text-sm font-semibold text-slate-800">{profData.cpf}</div>
                     </td>
                   </tr>
                   <tr className="border-b border-slate-300">
                     <td className="py-2">
                        <div className="italic text-slate-500 text-xs">RG</div>
                        <div className="text-sm font-semibold text-slate-800">{profData.rg}</div>
                     </td>
                   </tr>
                 </tbody>
               </table>
             </div>
             
             <div className="w-full flex flex-col items-center justify-center text-center text-sm text-slate-800 mt-auto">
               <p className="font-bold mb-1">{config.razaoSocial || "Razão Social"}</p>
               <p>{config.cnpj || "CNPJ"}</p>
             </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-5">
      <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-200 print:hidden">
        <h2 className="text-sm font-bold text-slate-800">Gerenciamento de Profissionais</h2>
        <button
          onClick={() => handleOpenModal()}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 flex items-center gap-2"
        >
          <Plus size={14} /> Novo Profissional
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-md print:hidden">
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
                      className="text-[#1a3c2e] bg-[#1a3c2e]/5 hover:bg-[#1a3c2e]/10 hover:text-[#1a3c2e] transition-colors   px-2 py-1 rounded-lg border border-[#1a3c2e]/10 flex items-center gap-1 font-extrabold text-[10px] cursor-pointer"
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
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 backdrop-blur-xs print:bg-white print:p-0 print:items-start">
          <form onSubmit={handleSave} className="bg-white p-6 rounded-2xl w-full max-w-3xl space-y-5 max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-100 print:shadow-none print:border-none print:max-h-full print:overflow-visible">
             <div className="flex justify-between items-center pb-2 border-b border-slate-100 print:hidden">
              <div className="flex flex-wrap items-center gap-3">
                <h3 className="font-extrabold text-[#1a3c2e] text-base sm:text-lg">
                  {editingProf ? 'Editar Cadastro de Profissional' : 'Novo Cadastro de Profissional'}
                </h3>
              </div>
              <div className="flex items-center gap-4">
                 {editingProf && (
                   <div className="flex items-center gap-2">
                     <button
                       type="button"
                       onClick={() => setFormData(prev => ({ ...prev, status: prev.status === 'Ativo' ? 'Inativo' : 'Ativo' }))}
                       className={`w-12 h-6 rounded-full transition-colors ${formData.status === 'Ativo' ? 'bg-[#1a3c2e]' : 'bg-[#d1d1d1]'}`}
                     >
                        <div className={`w-4 h-4 rounded-full bg-white transition-transform ${formData.status === 'Ativo' ? 'translate-x-7' : 'translate-x-1'}`} />
                     </button>
                     <span className={`text-xs font-bold ${formData.status === 'Ativo' ? 'text-[#1a3c2e]' : 'text-[#d1d1d1]'}`}>Status: {formData.status}</span>
                   </div>
                 )}
                 <button type="button" onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-50 transition-colors">
                    <X size={18} />
                 </button>
              </div>
            </div>
            
            <div className="flex gap-4 border-b pb-1.5 mb-2 print:hidden">
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
                <>
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
                  <button
                    type="button"
                    onClick={() => setActiveTab('cracha')}
                    className={`font-black pb-1.5 text-xs uppercase tracking-wider transition-colors border-b-2 ${
                      activeTab === 'cracha'
                        ? 'border-[#1a3c2e] text-[#1a3c2e]'
                        : 'border-transparent text-slate-400 hover:text-slate-600'
                    }`}
                  >
                    Gerar Crachá
                  </button>
                </>
              )}
            </div>

            {(() => {
              switch (activeTab) {
                case 'cracha': return <BadgeGerador profData={formData} />;
                case 'agenda': return (
                  <div className="space-y-4">
                     {/* ... (rest of the content from turn 2) ... */}
                  </div>
                );
                default: return (
                  <div className="space-y-6">
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 border border-slate-100 rounded-xl bg-slate-50">
                      <div className="md:col-span-3 flex justify-center">
                        <label className="relative cursor-pointer">
                          <input type="file" accept="image/*" onChange={handlePhotoChange} className="hidden" />
                          <div className="w-24 h-24 rounded-full border-2 border-dashed border-slate-300 flex items-center justify-center overflow-hidden bg-white hover:border-[#1a3c2e] transition-colors">
                            {formData.foto ? <img src={formData.foto} alt="Foto" className="w-full h-full object-cover"/> : <span className="text-xs text-slate-400">Foto</span>}
                          </div>
                        </label>
                      </div>
                      
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-[#1a3c2e] uppercase uppercase">Nome Completo</label>
                        <input type="text" placeholder="Digite o nome completo" value={formData.nome} onChange={e => setFormData({...formData, nome: e.target.value})} className="p-2 border border-slate-200 rounded-lg text-sm w-full focus:ring-1 focus:ring-[#1a3c2e]" required />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-[#1a3c2e] uppercase">Sexo</label>
                        <select value={formData.sexo} onChange={e => setFormData({...formData, sexo: e.target.value})} className="p-2 border border-slate-200 rounded-lg text-sm w-full">
                          <option value="">Selecione...</option>
                          <option value="Masculino">Masculino</option>
                          <option value="Feminino">Feminino</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-[#1a3c2e] uppercase">Data de Nascimento</label>
                        <input type="date" value={formData.dataNascimento} onChange={e => setFormData({...formData, dataNascimento: e.target.value})} className="p-2 border border-slate-200 rounded-lg text-sm w-full" />
                      </div>
                      <div className="space-y-1">
                         <label className="text-[10px] font-bold text-[#1a3c2e] uppercase">Idade</label>
                         <input type="text" value={formData.idade || ''} disabled className="p-2 border border-slate-200 rounded-lg text-sm w-full bg-slate-100" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-[#1a3c2e] uppercase">RG</label>
                        <input type="text" placeholder="Digite o RG" value={formData.rg} onChange={e => setFormData({...formData, rg: e.target.value})} className="p-2 border border-slate-200 rounded-lg text-sm w-full" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-[#1a3c2e] uppercase">CPF (Obrigatório)</label>
                        <input type="text" placeholder="Digite o CPF" value={formData.cpf} onChange={e => setFormData({...formData, cpf: e.target.value})} className="p-2 border border-slate-200 rounded-lg text-sm w-full" required />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-[#1a3c2e] uppercase">Profissão</label>
                        <input type="text" placeholder="Digite a profissão" value={formData.profissao} onChange={e => setFormData({...formData, profissao: e.target.value})} className="p-2 border border-slate-200 rounded-lg text-sm w-full" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-[#1a3c2e] uppercase">Conselho Profissional</label>
                        <input type="text" placeholder="Digite o conselho" value={formData.conselho} onChange={e => setFormData({...formData, conselho: e.target.value})} className="p-2 border border-slate-200 rounded-lg text-sm w-full" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-[#1a3c2e] uppercase">Telefone</label>
                        <input type="tel" placeholder="(00) 00000-0000" value={formData.telefone} onChange={e => setFormData({...formData, telefone: e.target.value})} className="p-2 border border-slate-200 rounded-lg text-sm w-full" />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 border border-slate-100 rounded-xl bg-slate-50">
                       <span className="md:col-span-4 font-bold text-xs text-[#1a3c2e] uppercase border-b pb-2 mb-2">Endereço</span>
                       <input type="text" placeholder="CEP" value={formData.endereco.cep} onChange={e => setFormData({...formData, endereco: {...formData.endereco, cep: e.target.value}})} className="p-2 border border-slate-200 rounded-lg text-sm" />
                       <input type="text" placeholder="Logradouro" value={formData.endereco.rua} onChange={e => setFormData({...formData, endereco: {...formData.endereco, rua: e.target.value}})} className="p-2 border border-slate-200 rounded-lg text-sm md:col-span-2" />
                       <input type="text" placeholder="Nº" value={formData.endereco.numero} onChange={e => setFormData({...formData, endereco: {...formData.endereco, numero: e.target.value}})} className="p-2 border border-slate-200 rounded-lg text-sm" />
                       <input type="text" placeholder="Bairro" value={formData.endereco.bairro} onChange={e => setFormData({...formData, endereco: {...formData.endereco, bairro: e.target.value}})} className="p-2 border border-slate-200 rounded-lg text-sm" />
                       <input type="text" placeholder="Cidade" value={formData.endereco.cidade} onChange={e => setFormData({...formData, endereco: {...formData.endereco, cidade: e.target.value}})} className="p-2 border border-slate-200 rounded-lg text-sm" />
                       <input type="text" placeholder="UF" value={formData.endereco.estado} onChange={e => setFormData({...formData, endereco: {...formData.endereco, estado: e.target.value}})} className="p-2 border border-slate-200 rounded-lg text-sm" />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 border border-slate-100 rounded-xl bg-slate-50">
                       <div className="md:col-span-4 flex items-center justify-between border-b pb-2 mb-2">
                          <span className="font-bold text-xs text-[#1a3c2e] uppercase">Financeiro</span>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-slate-500 normal-case">Titular da Conta?</span>
                            <select
                              value={isTitularConta}
                              onChange={(e) => setIsTitularConta(e.target.value)}
                              className="p-1 px-2 border border-slate-200 rounded-lg text-xs bg-white text-slate-700 outline-none focus:ring-1 focus:ring-[#1a3c2e] cursor-pointer"
                            >
                              <option value="Sim">Sim</option>
                              <option value="Não">Não</option>
                            </select>
                          </div>
                       </div>

                       {isTitularConta === 'Não' && (
                          <div className="md:col-span-4 grid grid-cols-1 md:grid-cols-3 gap-4 pb-4 border-b border-dashed border-slate-200/60 mb-2 animate-in fade-in slide-in-from-top-1 duration-200">
                            <div className="flex flex-col gap-1">
                              <label className="text-[10px] font-bold text-slate-500 uppercase">Nome do Titular da Conta</label>
                              <input
                                type="text"
                                placeholder="Nome Completo do Titular"
                                value={formData.nomeTitularConta || ''}
                                onChange={e => setFormData({ ...formData, nomeTitularConta: e.target.value })}
                                className="p-2 border border-slate-200 rounded-lg text-sm bg-white"
                                required={isTitularConta === 'Não'}
                              />
                            </div>
                            <div className="flex flex-col gap-1">
                              <label className="text-[10px] font-bold text-slate-500 uppercase">CPF do Titular</label>
                              <input
                                type="text"
                                placeholder="CPF do Titular"
                                value={formData.cpfTitularConta || ''}
                                onChange={e => setFormData({ ...formData, cpfTitularConta: e.target.value })}
                                className="p-2 border border-slate-200 rounded-lg text-sm bg-white"
                                required={isTitularConta === 'Não'}
                              />
                            </div>
                            <div className="flex flex-col gap-1">
                              <label className="text-[10px] font-bold text-slate-500 uppercase">Grau de Parentesco</label>
                              <select
                                value={formData.grauParentescoTitular || ''}
                                onChange={e => setFormData({ ...formData, grauParentescoTitular: e.target.value })}
                                className="p-2 border border-slate-200 rounded-lg text-sm bg-white cursor-pointer"
                                required={isTitularConta === 'Não'}
                              >
                                <option value="">Selecione...</option>
                                <option value="Cônjuge">Cônjuge</option>
                                <option value="Filho(a)">Filho(a)</option>
                                <option value="Pai/Mãe">Pai/Mãe</option>
                                <option value="Outro">Outro</option>
                              </select>
                            </div>
                          </div>
                       )}
                       <input type="text" placeholder="Banco" value={formData.dadosBancarios.banco} onChange={e => setFormData({...formData, dadosBancarios: {...formData.dadosBancarios, banco: e.target.value}})} className="p-2 border border-slate-200 rounded-lg text-sm" />
                       <input type="text" placeholder="Agência" value={formData.dadosBancarios.agencia} onChange={e => setFormData({...formData, dadosBancarios: {...formData.dadosBancarios, agencia: e.target.value}})} className="p-2 border border-slate-200 rounded-lg text-sm" />
                       <input type="text" placeholder="Conta" value={formData.dadosBancarios.conta} onChange={e => setFormData({...formData, dadosBancarios: {...formData.dadosBancarios, conta: e.target.value}})} className="p-2 border border-slate-200 rounded-lg text-sm" />
                       <input type="text" placeholder="PIX" value={formData.dadosBancarios.pix} onChange={e => setFormData({...formData, dadosBancarios: {...formData.dadosBancarios, pix: e.target.value}})} className="p-2 border border-slate-200 rounded-lg text-sm" />
                    </div>

                    <div className="space-y-3 p-4 border border-slate-100 rounded-xl bg-slate-50">
                        <span className="font-bold text-xs text-[#1a3c2e] uppercase border-b pb-2 flex items-center gap-1.5">
                            <Paperclip className="w-3.5 h-3.5" /> Documentos Anexos
                        </span>
                        
                        {!editingProf ? (
                          <div className="p-4 bg-amber-50 text-amber-800 border border-amber-200/50 rounded-xl text-xs flex items-center gap-2">
                            <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                            <span>Para anexar documentos, primeiro salve o cadastro básico deste novo profissional no botão "Salvar" abaixo.</span>
                          </div>
                        ) : (
                          <div className="space-y-4">
                            {/* Form de Upload */}
                            <div className="p-3 border border-slate-200/60 rounded-xl bg-white space-y-3">
                              <span className="block font-semibold text-xs text-slate-700">Adicionar Novo Documento</span>
                              <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                                <div className="space-y-1 md:col-span-5">
                                  <label className="text-[10px] font-bold text-slate-500 uppercase">Tipo de Documento</label>
                                  <select 
                                    value={tipoDocumentoAnexo} 
                                    onChange={e => setTipoDocumentoAnexo(e.target.value)}
                                    className="p-2 border border-slate-200 rounded-lg text-sm w-full bg-slate-50 focus:ring-1 focus:ring-[#1a3c2e] focus:outline-none"
                                  >
                                    <option value="">Selecione o tipo de documento...</option>
                                    <option value="Crachá">Crachá</option>
                                    <option value="Comprovante de residência">Comprovante de residência</option>
                                    <option value="Vacinas">Vacinas</option>
                                    <option value="Certificado">Certificado</option>
                                    <option value="Formulário">Formulário</option>
                                  </select>
                                </div>
                                
                                <div className="space-y-1 md:col-span-4">
                                  <label className="text-[10px] font-bold text-slate-500 uppercase">Arquivo</label>
                                  <input 
                                    type="file" 
                                    ref={documentoInputRef}
                                    onChange={e => setArquivoAnexo(e.target.files?.[0] || null)}
                                    className="p-1 border border-slate-200 rounded-lg text-xs w-full bg-slate-50 cursor-pointer"
                                  />
                                </div>

                                <div className="md:col-span-3">
                                  <button
                                    type="button"
                                    onClick={handleUploadAnexo}
                                    disabled={salvandoAnexo}
                                    className="w-full bg-[#1a3c2e] text-[#b8860b] hover:bg-[#132c22] disabled:bg-slate-300 disabled:text-slate-500 rounded-lg font-bold py-2 px-3 text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                                  >
                                    {salvandoAnexo ? (
                                      <>
                                        <span className="w-3 h-3 border-2 border-[#b8860b] border-t-transparent rounded-full animate-spin"></span>
                                        <span>Carregando...</span>
                                      </>
                                    ) : (
                                      <>
                                        <Plus className="w-3.5 h-3.5" />
                                        <span>Salvar Anexo</span>
                                      </>
                                    )}
                                  </button>
                                </div>
                              </div>
                            </div>

                            {/* Lista de Documentos já gravados */}
                            <div className="space-y-2">
                              <span className="block font-semibold text-xs text-slate-700">Arquivos Salvos ({ (formData.documentosAnexos || []).length })</span>
                              {(!formData.documentosAnexos || formData.documentosAnexos.length === 0) ? (
                                <p className="text-xs text-slate-400 italic p-2">Nenhum documento anexado ainda.</p>
                              ) : (
                                <div className="grid grid-cols-1 gap-2">
                                  {(formData.documentosAnexos || []).map((docItem) => (
                                    <div key={docItem.id} className="flex justify-between items-center bg-white p-2.5 rounded-lg border border-slate-100 shadow-sm text-xs">
                                      <div className="flex items-center gap-2 min-w-0 mr-4">
                                        <div className="p-1.5 bg-slate-100 rounded text-[#1a3c2e]">
                                          <Paperclip className="w-3.5 h-3.5" strokeWidth={2.5} />
                                        </div>
                                        <div className="truncate">
                                          <p className="font-bold text-[#1a3c2e]">{docItem.tipo}</p>
                                          <p className="text-[10px] text-slate-500 truncate">{docItem.nome || docItem.nomeArquivo || 'Anexo'}</p>
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-2 flex-shrink-0">
                                        {(docItem.url || docItem.arquivo) && (
                                          <button 
                                            type="button" 
                                            onClick={() => setPreviewDoc({
                                              url: docItem.url || docItem.arquivo || '',
                                              tipo: docItem.tipo || 'Documento',
                                              nome: docItem.nome || docItem.nomeArquivo || 'Anexo'
                                            })}
                                            className="px-2.5 py-1 text-[10px] font-bold text-[#b8860b] bg-[#b8860b]/10 rounded hover:bg-[#b8860b]/20 transition-colors cursor-pointer"
                                          >
                                            Visualizar
                                          </button>
                                        )}
                                        <button 
                                          type="button" 
                                          onClick={() => removeDocumentoAnexoRow(docItem.id)} 
                                          className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                          title="Deletar anexo definitivamente"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                    </div>
                  </div>
                  </div>
                );
              }
            })()}

            <div className="flex flex-col sm:flex-row gap-3 justify-between items-center pt-4 border-t border-slate-100 mt-2 print:hidden">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-5 py-2 hover:bg-gray-100 font-medium text-sm text-slate-600 rounded-lg transition-colors cursor-pointer w-full sm:w-auto">Cancelar / Fechar</button>
                {activeTab === 'dados' && (
                  <button type="submit" disabled={loading} className="bg-[#1a3c2e] text-[#b8860b] px-4 py-2 rounded-lg font-bold disabled:bg-gray-400">
                    {loading ? 'Salvando...' : 'Salvar'}
                  </button>
                )}
            </div>
          </form>
        </div>
      )}

      {successMessage && (
        <div className="fixed bottom-5 right-5 z-[100] bg-[#1a3c2e] text-[#b8860b] border border-[#b8860b]/30 px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2 animate-in fade-in slide-in-from-bottom-5 duration-300">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-sm font-semibold">{successMessage}</span>
          <button type="button" onClick={() => setSuccessMessage(null)} className="ml-2 text-[#b8860b]/70 hover:text-[#b8860b] text-xs font-bold leading-none">×</button>
        </div>
      )}

      {/* Modal de Visualização de Documentos */}
      {previewDoc && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full flex flex-col max-h-[90vh] overflow-hidden border border-slate-100 animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2 min-w-0">
                <div className="p-2 bg-[#1a3c2e]/10 text-[#1a3c2e] rounded-lg flex-shrink-0">
                  <Paperclip className="w-4 h-4" strokeWidth={2.5} />
                </div>
                <div className="truncate">
                  <h3 className="font-bold text-sm text-[#1a3c2e]">{previewDoc.tipo}</h3>
                  <p className="text-xs text-slate-500 truncate max-w-[200px] sm:max-w-md">{previewDoc.nome || 'Anexo'}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPreviewDoc(null)}
                className="p-1.5 px-3 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-lg text-xs transition-all font-bold cursor-pointer"
              >
                ✕ Fechar
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-4 sm:p-6 overflow-y-auto flex-grow flex items-center justify-center bg-slate-100/50 min-h-[300px]">
              {(() => {
                const isImg = isImageFile(previewDoc.url, previewDoc.nome);
                if (isImg) {
                  return (
                    <div className="relative group max-w-full">
                      <img
                        src={previewDoc.url}
                        alt={previewDoc.nome}
                        referrerPolicy="no-referrer"
                        className="max-h-[55vh] max-w-full object-contain mx-auto rounded-lg shadow-md border border-slate-200 bg-white"
                        onError={(e) => {
                          e.currentTarget.referrerPolicy = "";
                        }}
                      />
                    </div>
                  );
                } else {
                  return (
                    <div className="text-center p-6 sm:p-8 bg-white rounded-2xl border border-slate-200/50 shadow-sm max-w-md w-full space-y-4">
                      <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
                        <FileImage className="w-8 h-8" />
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-700 text-sm">Visualização de Documento</h4>
                        <p className="text-xs text-slate-500 mt-1">Este arquivo ({previewDoc.nome || 'Anexo'}) não é uma imagem comum ou requer um visualizador externo (ex: PDF grande).</p>
                      </div>
                      
                      <div className="flex flex-col gap-2 pt-2">
                        <a
                          href={previewDoc.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-full bg-[#1a3c2e] hover:bg-[#11291f] text-[#b8860b] py-2.5 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow transition-all cursor-pointer"
                        >
                          <Download className="w-4 h-4" />
                          <span>Abrir em Nova Aba</span>
                        </a>
                      </div>
                    </div>
                  );
                }
              })()}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-100 flex flex-col sm:flex-row gap-3 sm:gap-0 justify-between items-center bg-slate-50">
              <span className="text-[10px] font-semibold text-slate-400 font-mono truncate max-w-xs">Arquivo em Nuvem de Armazenamento Seguro</span>
              <div className="flex gap-2 w-full sm:w-auto justify-end">
                <a
                  href={previewDoc.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 text-xs font-semibold text-[#1a3c2e] hover:bg-slate-200/60 rounded-lg border border-slate-200 transition-all cursor-pointer inline-flex items-center gap-1 w-full sm:w-auto justify-center"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download</span>
                </a>
                <button
                  type="button"
                  onClick={() => setPreviewDoc(null)}
                  className="px-5 py-2 text-xs font-bold bg-[#1a3c2e] text-[#b8860b] hover:bg-[#122b21] rounded-lg shadow-sm transition-all cursor-pointer w-full sm:w-auto"
                >
                  Ok
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
