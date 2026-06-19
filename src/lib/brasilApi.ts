
export const fetchCep = async (cep: string) => {
  const cleanCep = cep.replace(/\D/g, '');
  if (cleanCep.length !== 8) return null;
  const response = await fetch(`https://brasilapi.com.br/api/cep/v1/${cleanCep}`);
  if (!response.ok) return null;
  return response.json();
};

export const fetchBanks = async () => {
  const response = await fetch('https://brasilapi.com.br/api/banks/v1');
  if (!response.ok) return [];
  const banks = await response.json();
  return banks.filter((b: any) => b.code !== null);
};

export const getHolidays = async (year: number) => {
  const response = await fetch(`https://brasilapi.com.br/api/feriados/v1/${year}`);
  const national = await response.json();
  
  // Feriados fixos RJ (data formato MMDD)
  const rjHolidays = [
    { date: `${year}-01-20`, name: 'São Sebastião (RJ)' },
    { date: `${year}-04-23`, name: 'São Jorge (RJ)' },
  ];
  
  return [...national, ...rjHolidays];
};
