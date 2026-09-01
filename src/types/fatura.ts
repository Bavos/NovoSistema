export interface Fatura {
  id?: string;
  clienteNome: string;
  clienteDocumento?: string; // CPF ou CNPJ
  clienteEmail?: string;
  valor: number;
  status: 'pendente' | 'pago' | 'vencido' | 'cancelado';
  dataVencimento: string;
  dataEmissao: string;
  descricao?: string;
  formaPagamento?: 'pix' | 'boleto' | 'cartao' | 'dinheiro';
  // Campos retornados pela integração bancária
  nossoNumero?: string;
  pixCopiaECola?: string;
  linhaDigitavel?: string;
  codigoBarras?: string;
  pdfUrl?: string;
  criadoEm?: any;
}
