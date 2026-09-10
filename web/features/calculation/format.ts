import { roundAwayFromZero } from '../../domain/game-tables.ts';
/** .NET Framework display rounds midpoint values away from zero. */
export const decimal = (n: number) => (roundAwayFromZero(n * 10) / 10).toFixed(1);
export function shellLabel(shell: string, language: 'ru' | 'en'): string {
  if (language === 'ru') return shell;
  const names: Record<string, string> = { 'О-832ДУ · осколочный': 'O-832DU · HE', 'Д-832ДУ · дымовой': 'D-832DU · Smoke', 'С-832С · осветительный': 'S-832S · Illumination' };
  return names[shell] ?? shell;
}
