/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Paciente, Plantao } from './types';

export const INITIAL_PACIENTES: Paciente[] = [];

export const INITIAL_PLANTOES: Plantao[] = [];

export interface Professional {
  name: string;
  role: string;
  id: string;
  status: string;
  tel: string;
  rating: string;
  area: string;
}

export const INITIAL_PROFESSIONALS: Professional[] = [
  { name: 'Dra. Maria Santos', role: 'Médica Geriatra', id: 'prof-1', status: 'Ativo', tel: '(21) 94444-1122', rating: '5.0', area: 'Copacabana / Ipanema' },
  { name: 'Téc. Pedro Albuquerque', role: 'Técnico em Enfermagem', id: 'prof-2', status: 'Em Plantão', tel: '(21) 93333-5566', rating: '4.9', area: 'Zona Sul / Leme' },
  { name: 'Enf. Juliana Silveira', role: 'Enfermeira Padrão', id: 'prof-3', status: 'Ativo', tel: '(21) 92222-7788', rating: '5.0', area: 'Barra / Recreio' },
  { name: 'Cuidador Thiago Neves', role: 'Cuidador Especializado', id: 'prof-4', status: 'Descanso', tel: '(21) 91111-9900', rating: '4.8', area: 'Botafogo / Flamengo' },
  { name: 'Fis. Dra. Luciana Varela', role: 'Fisioterapeuta Motora', id: 'prof-5', status: 'Ativo', tel: '(21) 95555-3344', rating: '4.9', area: 'Leblon / Jardim Botânico' },
];

