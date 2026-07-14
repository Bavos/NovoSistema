import { z } from 'zod';

export const pacienteSchema = z.object({
  nome: z.string().min(3, "Nome é obrigatório e deve ter no mínimo 3 caracteres"),
  cpf: z.string().regex(/^\d{11}$/, "CPF deve conter 11 dígitos numéricos"),
  nomeResponsavel: z.string().min(3, "Nome do responsável é obrigatório"),
  telefoneResponsavel: z.string().min(1, "Telefone do Responsável é obrigatório"),
  telefoneResponsavel2: z.string().optional(),
  parentescoResponsavel: z.string().optional(),
  telefone: z.string().optional(),
});

export const profissionalSchema = z.object({
  nome: z.string().min(3, "Nome é obrigatório"),
  cpf: z.string().regex(/^\d{11}$/, "CPF deve conter 11 dígitos numéricos"),
  profissao: z.string().min(3, "Profissão é obrigatória"),
  telefone: z.string().optional(),
  meiIrregular: z.boolean().optional(),
});
