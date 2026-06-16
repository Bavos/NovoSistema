import React, { useState, useEffect, useRef } from 'react';
import html2canvas from 'html2canvas';
import { useFirebase } from '../context/FirebaseContext';
import { Profissional, Agendamento, DocumentoAnexo } from '../types';
import { Plus, Edit2, Trash2, X, Check, CalendarDays, Paperclip, AlertCircle, Printer, Download, FileImage } from 'lucide-react';
import { db } from '../lib/firebase';
import { collection, query, where, orderBy, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { profissionalSchema } from '../schemas/validationSchemas';


export const Profissionais: React.FC = () => {
  const { profissionais, addProfissional, updateProfissional, deleteProfissional, uploadLogo, uploadProfissionalFoto, uploadPdf } = useFirebase();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [editingProf, setEditingProf] = useState<Profissional | null>(null);
  const [activeTab, setActiveTab] = useState<'dados' | 'agenda' | 'cracha'>('dados');
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

  const handleOpenModal = (prof: Profissional | null = null, initialTab: 'dados' | 'agenda' | 'cracha' = 'dados') => {
    setEditingProf(prof);
    setActiveTab(initialTab);
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
        ativo: formData.status === 'Ativo'
      };
      if (editingProf) {
        await updateProfissional({ ...editingProf, ...finalData });
      } else {
        await addProfissional(finalData);
      }
      setIsModalOpen(false);
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
      } catch (err) {
        console.error("Erro ao subir foto:", err);
        alert("Erro ao enviar foto. Tente novamente.");
      } finally {
        setUploading(false);
      }
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

  const handleDocumentoFileChange = async (id: string | number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploading(true);
      try {
        const url = await uploadPdf(file, `documentos/${id}_${file.name}`);
        setFormData(prev => ({
          ...prev,
          documentosAnexos: (prev.documentosAnexos || []).map(doc =>
            doc.id === id ? { ...doc, arquivo: url, nomeArquivo: file.name } : doc
          )
        }));
      } catch (err) {
        console.error("Erro ao subir documento:", err);
        alert("Erro ao enviar documento. Tente novamente.");
      } finally {
        setUploading(false);
      }
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
      
      const restoredStyles: (() => void)[] = [];
      try {
        console.log("[BadgeGerador] Sanitizing stylesheets for PNG to bypass html2canvas oklch parse error...");
        
        // 1. Sanitize standard <style> tags loaded by Vite
        const styleTags = Array.from(document.querySelectorAll('style'));
        for (const styleTag of styleTags) {
          const originalText = styleTag.textContent;
          if (originalText && originalText.includes('oklch')) {
            const sanitizedText = originalText.replace(/oklch\([^)]+\)/g, 'rgb(128, 128, 128)');
            styleTag.textContent = sanitizedText;
            restoredStyles.push(() => {
              styleTag.textContent = originalText;
            });
          }
        }

        // 2. Sanitize any link tags if present in built environment
        const linkTags = Array.from(document.querySelectorAll('link[rel="stylesheet"]')) as HTMLLinkElement[];
        for (const linkTag of linkTags) {
          try {
            const isSameOrigin = !linkTag.href || linkTag.href.startsWith(window.location.origin) || !linkTag.href.startsWith('http');
            if (isSameOrigin) {
              const response = await fetch(linkTag.href);
              if (response.ok) {
                const originalCss = await response.text();
                if (originalCss.includes('oklch')) {
                  const sanitizedCss = originalCss.replace(/oklch\([^)]+\)/g, 'rgb(128, 128, 128)');
                  const tempStyle = document.createElement('style');
                  tempStyle.setAttribute('data-sanitizer-temp', 'true');
                  tempStyle.textContent = sanitizedCss;
                  document.head.appendChild(tempStyle);
                  
                  linkTag.disabled = true;
                  restoredStyles.push(() => {
                    document.head.removeChild(tempStyle);
                    linkTag.disabled = false;
                  });
                }
              }
            }
          } catch (err) {
            console.warn("[BadgeGerador] Handled link tag: ", err);
          }
        }
      } catch (e) {
        console.warn("[BadgeGerador] Stylesheet sanitization error:", e);
      }

      if (badgeRef.current) {
        try {
          console.log("[BadgeGerador] Starting html2canvas capture for PNG...");
          const canvas = await html2canvas(badgeRef.current, {
            scale: 2,
            useCORS: true,
            allowTaint: true,
            logging: true,
            backgroundColor: '#ffffff'
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
        } finally {
          // RESTORE ALL ORIGINAL STYLES RETROACTIVELY
          console.log("[BadgeGerador] Restoring original stylesheets...");
          restoredStyles.forEach(restore => {
            try {
              restore();
            } catch (e) {
              console.error("[BadgeGerador] Error while restoring style:", e);
            }
          });
        }
      } else {
        alert("Referência do elemento do crachá não encontrada.");
        restoredStyles.forEach(restore => {
          try {
            restore();
          } catch {}
        });
      }
      setLoading(false);
    };

    const handleDownloadWord = async () => {
      setLoading(true);
      
      const restoredStyles: (() => void)[] = [];
      try {
        console.log("[BadgeGerador] Sanitizing stylesheets to bypass html2canvas oklch parse error...");
        
        // 1. Sanitize standard <style> tags loaded by Vite
        const styleTags = Array.from(document.querySelectorAll('style'));
        for (const styleTag of styleTags) {
          const originalText = styleTag.textContent;
          if (originalText && originalText.includes('oklch')) {
            const sanitizedText = originalText.replace(/oklch\([^)]+\)/g, 'rgb(128, 128, 128)');
            styleTag.textContent = sanitizedText;
            restoredStyles.push(() => {
              styleTag.textContent = originalText;
            });
          }
        }

        // 2. Sanitize any link tags if present in built environment
        const linkTags = Array.from(document.querySelectorAll('link[rel="stylesheet"]')) as HTMLLinkElement[];
        for (const linkTag of linkTags) {
          try {
            const isSameOrigin = !linkTag.href || linkTag.href.startsWith(window.location.origin) || !linkTag.href.startsWith('http');
            if (isSameOrigin) {
              const response = await fetch(linkTag.href);
              if (response.ok) {
                const originalCss = await response.text();
                if (originalCss.includes('oklch')) {
                  const sanitizedCss = originalCss.replace(/oklch\([^)]+\)/g, 'rgb(128, 128, 128)');
                  const tempStyle = document.createElement('style');
                  tempStyle.setAttribute('data-sanitizer-temp', 'true');
                  tempStyle.textContent = sanitizedCss;
                  document.head.appendChild(tempStyle);
                  
                  linkTag.disabled = true;
                  restoredStyles.push(() => {
                    document.head.removeChild(tempStyle);
                    linkTag.disabled = false;
                  });
                }
              }
            }
          } catch (err) {
            console.warn("[BadgeGerador] Handled link tag: ", err);
          }
        }
      } catch (e) {
        console.warn("[BadgeGerador] Stylesheet sanitization error:", e);
      }

      if (badgeRef.current) {
        try {
          console.log("[BadgeGerador] Starting html2canvas capture...");
          const canvas = await html2canvas(badgeRef.current, {
            scale: 2,
            useCORS: true,
            allowTaint: true, // safe because we converted to base64 but can render other parts
            logging: true,
            backgroundColor: '#ffffff'
          });
          
          console.log("[BadgeGerador] Canvas generated successfully. Converting to blob.");
          const imgData = canvas.toDataURL('image/png');
          const html = '<html><body style="margin:0; padding:0; display:flex; justify-content:center; align-items:center;"><img src="' + imgData + '" style="width:100%; max-width:700px; display:block;"/></body></html>';
          const blob = new Blob(['\ufeff', html], { type: 'application/msword' });
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `cracha_${profData.nome || 'profissional'}.doc`;
          link.click();
          URL.revokeObjectURL(url);
          console.log("[BadgeGerador] Badge file triggered for download.");
        } catch (err: any) {
          console.error("Erro ao gerar Word:", err);
          alert(`Infelizmente erro ao gerar o arquivo de download: ${err.message || String(err)}\nPor favor tente novamente.`);
        } finally {
          // RESTORE ALL ORIGINAL STYLES RETROACTIVELY
          console.log("[BadgeGerador] Restoring original stylesheets...");
          restoredStyles.forEach(restore => {
            try {
              restore();
            } catch (e) {
              console.error("[BadgeGerador] Error while restoring style:", e);
            }
          });
        }
      } else {
        alert("Referência do elemento do crachá não encontrada.");
        restoredStyles.forEach(restore => {
          try {
            restore();
          } catch {}
        });
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
        <div className="flex flex-row gap-0 justify-center items-stretch print:flex-row print:gap-0 p-4 bg-white rounded-lg border-2 border-slate-300 w-[700px] h-[400px]" ref={badgeRef}>
          {/* Lado Esquerdo (Frente) */}
          <div className="w-1/2 border-r border-slate-300 p-6 flex flex-col items-center justify-between text-center">
             <div className="w-full flex justify-center mb-4">
                {loadingConfig ? (
                  <div className="w-32 h-16 bg-gray-100 animate-pulse rounded" />
                ) : logoBase64 ? (
                  <img src={logoBase64} alt="Logo" className="h-16 w-auto object-contain font-medium" crossOrigin="anonymous" />
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
                       <span className="md:col-span-4 font-bold text-xs text-[#1a3c2e] uppercase border-b pb-2 mb-2">Financeiro</span>
                       <input type="text" placeholder="Banco" value={formData.dadosBancarios.banco} onChange={e => setFormData({...formData, dadosBancarios: {...formData.dadosBancarios, banco: e.target.value}})} className="p-2 border border-slate-200 rounded-lg text-sm" />
                       <input type="text" placeholder="Agência" value={formData.dadosBancarios.agencia} onChange={e => setFormData({...formData, dadosBancarios: {...formData.dadosBancarios, agencia: e.target.value}})} className="p-2 border border-slate-200 rounded-lg text-sm" />
                       <input type="text" placeholder="Conta" value={formData.dadosBancarios.conta} onChange={e => setFormData({...formData, dadosBancarios: {...formData.dadosBancarios, conta: e.target.value}})} className="p-2 border border-slate-200 rounded-lg text-sm" />
                       <input type="text" placeholder="PIX" value={formData.dadosBancarios.pix} onChange={e => setFormData({...formData, dadosBancarios: {...formData.dadosBancarios, pix: e.target.value}})} className="p-2 border border-slate-200 rounded-lg text-sm" />
                    </div>

                    <div className="space-y-2">
                        <div className="flex justify-between items-center">
                            <span className="font-bold text-xs text-[#1a3c2e] uppercase">Documentos Anexos</span>
                            <button type="button" onClick={addDocumentoAnexoRow} className="text-[#b8860b] text-xs font-bold">+ Adicionar</button>
                        </div>
                        {(formData.documentosAnexos || []).map((doc, index) => (
                             <div key={doc.id} className="flex gap-2 items-center p-2 border rounded-lg">
                                <select value={doc.tipo} onChange={e => updateDocumentoAnexoRow(doc.id, 'tipo', e.target.value)} disabled={!!doc.arquivo} className="p-2 border rounded-lg text-sm w-1/3">
                                    <option value="Selecione">Selecione...</option>
                                    <option value="Crachá">Crachá</option>
                                    <option value="Certificado">Certificado</option>
                                </select>
                                <input type="file" onChange={e => handleDocumentoFileChange(doc.id, e)} className="text-sm p-2" />
                                <button type="button" onClick={() => removeDocumentoAnexoRow(doc.id)} className="text-red-500 hover:text-red-700">X</button>
                             </div>
                        ))}
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
    </div>
  );
};
