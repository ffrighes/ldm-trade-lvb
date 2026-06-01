export interface Unidade {
  simbolo: string;
  grandeza: string;
}

export const UNIDADES: Unidade[] = [
  { simbolo: 'bar',  grandeza: 'Pressão' },
  { simbolo: 'm³/h', grandeza: 'Vazão' },
  { simbolo: 'mm',   grandeza: 'Comprimento' },
  { simbolo: '°C',   grandeza: 'Temperatura' },
  { simbolo: 'kg',   grandeza: 'Massa' },
  { simbolo: 'kN',   grandeza: 'Força' },
  { simbolo: 'MPa',  grandeza: 'Pressão' },
  { simbolo: 'm/s',  grandeza: 'Velocidade' },
  { simbolo: 'L/min',grandeza: 'Vazão' },
  { simbolo: 'm',    grandeza: 'Comprimento' },
  { simbolo: 'in',   grandeza: 'Comprimento' },
  { simbolo: 'psi',  grandeza: 'Pressão' },
  { simbolo: '%',    grandeza: 'Percentual' },
  { simbolo: 'adim', grandeza: 'Adimensional' },
];
