export type InputUnit = 'yen' | 'thousand' | 'million' | 'billion';

const UNIT_MULTIPLIERS: Record<InputUnit, number> = {
  yen: 1,
  thousand: 1_000,
  million: 1_000_000,
  billion: 1_000_000_000,
};

export const INPUT_UNIT_LABELS: Record<InputUnit, string> = {
  yen: '円',
  thousand: '千円',
  million: '百万円',
  billion: '10億円',
};

export function toYen(value: number, unit: InputUnit): number {
  return Math.round(value * UNIT_MULTIPLIERS[unit]);
}

export function fromYen(valueInYen: number, unit: InputUnit): number {
  return valueInYen / UNIT_MULTIPLIERS[unit];
}
