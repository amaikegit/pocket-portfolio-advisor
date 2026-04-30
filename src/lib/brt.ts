// Helpers para fixar o fuso horário em America/Sao_Paulo (BRT/BRST).
// Independem do fuso do navegador do usuário.

export const BRT_TZ = "America/Sao_Paulo";

/** Data/hora completa formatada em pt-BR no fuso de Brasília. */
export function formatBRDateTime(input: Date | string | number): string {
  const d = input instanceof Date ? input : new Date(input);
  return d.toLocaleString("pt-BR", { timeZone: BRT_TZ });
}

/** Apenas a data (dd/mm/aaaa) em pt-BR no fuso de Brasília. */
export function formatBRDate(input: Date | string | number): string {
  const d = input instanceof Date ? input : new Date(input);
  return d.toLocaleDateString("pt-BR", { timeZone: BRT_TZ });
}

/** Apenas a hora (HH:mm:ss) em pt-BR no fuso de Brasília. */
export function formatBRTime(input: Date | string | number): string {
  const d = input instanceof Date ? input : new Date(input);
  return d.toLocaleTimeString("pt-BR", { timeZone: BRT_TZ });
}

/** Retorna a data atual em formato ISO yyyy-mm-dd no fuso de Brasília. */
export function todayISOInBRT(date: Date = new Date()): string {
  // en-CA produz yyyy-mm-dd estável.
  return date.toLocaleDateString("en-CA", { timeZone: BRT_TZ });
}