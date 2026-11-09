import { useSearchParams } from 'react-router-dom'
import { Download, Search } from 'lucide-react'
import { useDados } from '../lib/dados'
import { exportarContatos } from '../lib/planilha'
import type { Status } from '../lib/tipos'
import { useOrdemFixa } from '../lib/ordem'
import { cx, hoje, ORDEM_STATUS, STATUS, VENDEDORAS } from '../lib/utils'
import { ListaContatos } from '../components/ListaContatos'
import { Button, PageHeader } from '../components/ui'
import { filtrarBusca } from './MeusContatos'
import { Progresso } from './Listas'

export default function Acompanhamento() {
  const { dados } = useDados()
  const equipe = dados.equipe ?? []
  const [params, setParams] = useSearchParams()
  const lista = params.get('lista') ?? ''
  const vendedora = params.get('vendedora') ?? ''
  const status = params.get('status') ?? ''
  const busca = params.get('q') ?? ''
  const muda = (k: string, v: string) => {
    const p = new URLSearchParams(params)
    if (v) p.set(k, v)
    else p.delete(k)
    setParams(p, { replace: true })
  }
  const nomeDe = (v: string) => equipe.find((m) => m.vaga === v)?.nome ?? v
  const h = hoje()

  const daLista = dados.contatos.filter((c) => !lista || c.listaId === lista)
  // Mexidos por último primeiro, mas a ordem fica parada enquanto os filtros não mudam
  const ordenados = useOrdemFixa(
    daLista.filter((c) => (!vendedora || c.vendedora === vendedora) && (!status || (status === 'atrasado' ? c.retorno && c.retorno <= h && !STATUS[c.status].final : c.status === status))),
    `${lista}|${vendedora}|${status}`,
    (a, b) => (b.atualizadoEm ?? '').localeCompare(a.atualizadoEm ?? ''),
  )
  const filtrados = filtrarBusca(ordenados, busca)

  const listaAtual = dados.listas.find((l) => l.id === lista)
  const exportar = () =>
    exportarContatos(`${listaAtual?.nome ?? 'Contatos'}${vendedora ? ` - ${nomeDe(vendedora)}` : ''}.xlsx`, filtrados, equipe, dados.config.checklist, listaAtual?.colunas ?? [])

  return (
    <>
      <PageHeader
        title="Acompanhamento"
        subtitle="O que cada vendedora já fez, com checklist e observações"
        actions={<Button variant="secondary" onClick={() => void exportar()} disabled={!filtrados.length}><Download size={15} /> Baixar Excel</Button>}
      />

      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {VENDEDORAS.filter((v) => daLista.some((c) => c.vendedora === v)).map((v) => {
          const dela = daLista.filter((c) => c.vendedora === v)
          const fin = dela.filter((c) => STATUS[c.status].final).length
          const atrasados = dela.filter((c) => c.retorno && c.retorno <= h && !STATUS[c.status].final).length
          return (
            <button
              key={v}
              onClick={() => muda('vendedora', vendedora === v ? '' : v)}
              className={cx('rounded-xl border bg-white p-3 text-left shadow-sm transition', vendedora === v ? 'border-azul-400 ring-2 ring-azul-100' : 'border-slate-200 hover:border-azul-200')}
            >
              <p className="truncate text-sm font-semibold text-brand-600">{nomeDe(v)}</p>
              <p className="mt-0.5 text-xs text-slate-500">
                {fin}/{dela.length} finalizados · <b className="text-verde-700">{dela.filter((c) => c.status === 'vendeu').length} vendas</b>
              </p>
              <div className="mt-2"><Progresso feitos={fin} total={dela.length} /></div>
              {atrasados > 0 && <p className="mt-1 text-[11px] font-semibold text-red-600">{atrasados} retorno(s) atrasado(s)</p>}
            </button>
          )
        })}
      </div>

      <div className="mb-3 flex flex-wrap gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input className="input pl-9" placeholder="Buscar nome, telefone, observação…" value={busca} onChange={(e) => muda('q', e.target.value)} />
        </div>
        <select className="input w-auto" value={lista} onChange={(e) => muda('lista', e.target.value)}>
          <option value="">Todas as listas</option>
          {dados.listas.map((l) => <option key={l.id} value={l.id}>{l.nome}</option>)}
        </select>
        <select className="input w-auto" value={vendedora} onChange={(e) => muda('vendedora', e.target.value)}>
          <option value="">Todas as vendedoras</option>
          {VENDEDORAS.map((v) => <option key={v} value={v}>{nomeDe(v)}</option>)}
        </select>
        <select className="input w-auto" value={status} onChange={(e) => muda('status', e.target.value)}>
          <option value="">Todas as situações</option>
          {ORDEM_STATUS.map((s: Status) => <option key={s} value={s}>{STATUS[s].label}</option>)}
          <option value="atrasado">Retorno atrasado</option>
        </select>
      </div>
      <p className="mb-2 text-xs text-slate-500">{filtrados.length} contato(s) · os que foram mexidos por último aparecem primeiro</p>

      <ListaContatos key={lista + vendedora + status} contatos={filtrados} equipe={equipe} mostrarLista={!lista} vazio="Nenhum contato com esses filtros." />
    </>
  )
}
