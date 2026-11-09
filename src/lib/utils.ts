import type { Status, Vaga } from './tipos'

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ')

export const STATUS: Record<Status, { label: string; cls: string; final: boolean }> = {
  pendente: { label: 'Não iniciado', cls: 'bg-slate-100 text-slate-600', final: false },
  andamento: { label: 'Em andamento', cls: 'bg-azul-50 text-azul-700', final: false },
  retornar: { label: 'Retornar', cls: 'bg-amber-50 text-amber-700', final: false },
  vendeu: { label: 'Vendeu', cls: 'bg-verde-50 text-verde-700', final: true },
  sem_interesse: { label: 'Sem interesse', cls: 'bg-red-50 text-red-700', final: true },
  sem_contato: { label: 'Não atende / nº errado', cls: 'bg-slate-200 text-slate-700', final: true },
}
export const ORDEM_STATUS = Object.keys(STATUS) as Status[]

export const VENDEDORAS: Vaga[] = ['v1', 'v2', 'v3', 'v4', 'v5']

const soDigitos = (s: string) => s.replace(/\D/g, '')

/** Link do WhatsApp; números sem DDI recebem o 55 do Brasil. */
export function linkWhats(telefone: string) {
  let d = soDigitos(telefone)
  if (!d) return undefined
  if (d.length <= 11) d = `55${d.replace(/^0+/, '')}`
  return `https://wa.me/${d}`
}

export const linkLigar = (telefone: string) => (soDigitos(telefone) ? `tel:${soDigitos(telefone)}` : undefined)

export const dataCurta = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
export const dataHora = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
/** yyyy-MM-dd de hoje no fuso local. */
export const hoje = () => new Date().toLocaleDateString('en-CA')
export const dataBr = (ymd: string) => ymd.split('-').reverse().join('/')

export const semAcento = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
