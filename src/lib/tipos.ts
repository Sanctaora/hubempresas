/** Tipos compartilhados entre o painel (src) e o servidor (api). */

export type Papel = 'dono' | 'gerente' | 'vendedora'

/** Os 7 acessos fixos. */
export const VAGAS = ['dono', 'gerente', 'v1', 'v2', 'v3', 'v4', 'v5'] as const
export type Vaga = (typeof VAGAS)[number]

export const papelDaVaga = (v: Vaga): Papel => (v === 'dono' ? 'dono' : v === 'gerente' ? 'gerente' : 'vendedora')

/** Dados de um acesso como o painel enxerga (sem a senha). */
export interface Membro {
  vaga: Vaga
  papel: Papel
  nome: string
  usuario: string
  ativo: boolean
  /** Já existe senha (de primeiro acesso ou definitiva). */
  temSenha: boolean
  /** Ainda está com a senha de primeiro acesso. */
  trocarSenha: boolean
}

export type Status = 'pendente' | 'andamento' | 'retornar' | 'vendeu' | 'sem_interesse' | 'sem_contato'

export interface Contato {
  id: string
  listaId: string
  vendedora: Vaga
  nome: string
  telefone: string
  /** Demais colunas da planilha, como vieram. */
  dados: Record<string, string>
  status: Status
  checklist: Record<string, boolean>
  obs: string
  /** yyyy-MM-dd */
  retorno?: string
  atualizadoEm?: string
  atualizadoPor?: Vaga
}

export interface Lista {
  id: string
  nome: string
  colunas: string[]
  criadaEm: string
  criadaPor: Vaga
  total: number
  /** Quantos contatos cada vendedora recebeu. */
  porVendedora: Partial<Record<Vaga, number>>
}

export interface Config {
  checklist: string[]
}

export interface Dados {
  eu: Membro
  config: Config
  listas: Lista[]
  contatos: Contato[]
  /** Só para dono e gerente. */
  equipe?: Membro[]
}

/** Campos que a vendedora pode mudar no contato. */
export type Mudancas = Partial<Pick<Contato, 'status' | 'checklist' | 'obs' | 'retorno'>> & { vendedora?: Vaga }
