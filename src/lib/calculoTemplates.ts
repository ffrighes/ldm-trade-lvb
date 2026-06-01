// ============================================================
// TEMPLATES DE CÁLCULO — PREENCHA COM SUAS FÓRMULAS REAIS
//
// Cada entrada deste array define um tipo de memória de cálculo.
// O template semeado abaixo é APENAS um placeholder de exemplo.
// Substitua-o (ou adicione novos) com suas fórmulas de engenharia
// reais antes de usar em produção.
//
// Campos:
//   id              — identificador estável (não altere após uso em produção)
//   nome            — rótulo exibido na UI
//   grandeza        — categoria / tipo do cálculo (texto livre)
//   campos          — entradas esperadas, cada uma com unidade fixa
//   formulaKatex    — fórmula em sintaxe KaTeX (apenas para exibição)
//   resultadoUnidade— unidade do resultado (símbolos de src/lib/unidades.ts)
// ============================================================

export interface CalculoTemplateCampo {
  id: string;
  nome: string;
  unidade: string;
}

export interface CalculoTemplate {
  id: string;
  nome: string;
  grandeza: string;
  campos: CalculoTemplateCampo[];
  formulaKatex: string;
  resultadoUnidade: string;
}

export const CALCULO_TEMPLATES: CalculoTemplate[] = [
  // ──────────────────────────────────────────────────────────
  // PLACEHOLDER — substitua por seus templates reais
  // ──────────────────────────────────────────────────────────
  {
    id: 'exemplo-generico',
    nome: '[EXEMPLO] Soma simples',
    grandeza: 'Exemplo',
    campos: [
      { id: 'a', nome: 'Valor A', unidade: 'adim' },
      { id: 'b', nome: 'Valor B', unidade: 'adim' },
    ],
    formulaKatex: 'R = a + b',
    resultadoUnidade: 'adim',
  },
];

// Template especial — o editor de perda de carga usa sua própria página dedicada.
// Este ID é usado apenas para identificar registros na tabela calculos.
export const PERDA_CARGA_TEMPLATE_ID = 'perda-carga-circuito';

export function getTemplateById(id: string): CalculoTemplate | undefined {
  return CALCULO_TEMPLATES.find((t) => t.id === id);
}
