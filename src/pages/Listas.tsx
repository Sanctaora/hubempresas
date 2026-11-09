import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Download, Pencil, Trash2, Upload } from 'lucide-react'
import { api } from '../lib/api'
import { useDados } from '../lib/dados'
import { exportarContatos } from '../lib/planilha'
import type { Lista } from '../lib/tipos'
import { dataCurta, STATUS, VENDEDORAS } from '../lib/utils'
import { ImportarLista } from '../components/ImportarLista'
import { Button, Card, Empty, PageHeader } from '../components/ui'

export function Progresso({ feitos, total }: { feitos: number; total: number }) {
  const p = total ? Math.round((feitos / total) * 100) : 0
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-brand-gradient" style={{ width: `${p}%` }} />
      </div>
      <span className="w-9 text-right text-xs tabular-nums text-slate-500">{p}%</span>
    </div>
  )
}

export default function Listas() {
  const { dados, recarregar, setDados } = useDados()
  const [importar, setImportar] = useState(false)
  const equipe = dados.equipe ?? []
  const nomeDe = (v: string) => equipe.find((m) => m.vaga === v)?.nome ?? v
  const listas = [...dados.listas].sort((a, b) => b.criadaEm.localeCompare(a.criadaEm))

  const excluir = async (l: Lista) => {
    if (!confirm(`Excluir a lista "${l.nome}" com ${l.total} contatos?\n\nTudo que as vendedoras marcaram nela (checklist e observações) será apagado. Não dá para desfazer.`)) return
    await api('excluirLista', { id: l.id })
    await recarregar()
  }

  const renomear = async (l: Lista) => {
    const nome = prompt('Novo nome da lista:', l.nome)?.trim()
    if (!nome || nome === l.nome) return
    await api('renomearLista', { id: l.id, nome })
    setDados((d) => ({ ...d, listas: d.listas.map((x) => (x.id === l.id ? { ...x, nome } : x)) }))
  }

  const exportar = (l: Lista) =>
    exportarContatos(`${l.nome}.xlsx`, dados.contatos.filter((c) => c.listaId === l.id), equipe, dados.config.checklist, l.colunas)

  return (
    <>
      <PageHeader
        title="Listas de contatos"
        subtitle="Suba uma planilha e o painel divide os contatos entre as vendedoras"
        actions={<Button onClick={() => setImportar(true)}><Upload size={15} /> Subir lista</Button>}
      />

      {!listas.length ? (
        <Empty>Nenhuma lista ainda. Clique em <b>Subir lista</b> e escolha uma planilha (.xlsx ou .csv).</Empty>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {listas.map((l) => {
            const contatos = dados.contatos.filter((c) => c.listaId === l.id)
            const finalizados = contatos.filter((c) => STATUS[c.status].final).length
            const vendas = contatos.filter((c) => c.status === 'vendeu').length
            return (
              <Card
                key={l.id}
                title={l.nome}
                action={
                  <div className="flex gap-0.5 text-slate-400">
                    <button title="Renomear" onClick={() => void renomear(l)} className="rounded p-1.5 hover:bg-slate-100 hover:text-brand-600"><Pencil size={15} /></button>
                    <button title="Baixar planilha com os resultados" onClick={() => void exportar(l)} className="rounded p-1.5 hover:bg-slate-100 hover:text-brand-600"><Download size={15} /></button>
                    <button title="Excluir" onClick={() => void excluir(l)} className="rounded p-1.5 hover:bg-red-50 hover:text-red-600"><Trash2 size={15} /></button>
                  </div>
                }
              >
                <p className="-mt-2 mb-3 text-xs text-slate-500">
                  {l.total} contatos · subida em {dataCurta(l.criadaEm)} por {nomeDe(l.criadaPor)} · <b className="text-verde-700">{vendas} {vendas === 1 ? 'venda' : 'vendas'}</b>
                </p>
                <Progresso feitos={finalizados} total={contatos.length} />
                <table className="mt-3 w-full text-sm">
                  <thead className="text-left text-[11px] uppercase tracking-wide text-slate-400">
                    <tr><th className="pb-1 font-semibold">Vendedora</th><th className="pb-1 text-right font-semibold">Recebeu</th><th className="pb-1 text-right font-semibold">Mexeu</th><th className="pb-1 text-right font-semibold">Finalizou</th><th className="pb-1 text-right font-semibold">Vendas</th></tr>
                  </thead>
                  <tbody>
                    {VENDEDORAS.filter((v) => contatos.some((c) => c.vendedora === v)).map((v) => {
                      const dela = contatos.filter((c) => c.vendedora === v)
                      return (
                        <tr key={v} className="border-t border-slate-100">
                          <td className="py-1.5">
                            <Link to={`/acompanhamento?lista=${l.id}&vendedora=${v}`} className="hover:text-azul-600 hover:underline">{nomeDe(v)}</Link>
                          </td>
                          <td className="text-right tabular-nums">{dela.length}</td>
                          <td className="text-right tabular-nums">{dela.filter((c) => c.status !== 'pendente').length}</td>
                          <td className="text-right tabular-nums">{dela.filter((c) => STATUS[c.status].final).length}</td>
                          <td className="text-right font-semibold tabular-nums text-verde-700">{dela.filter((c) => c.status === 'vendeu').length}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
                <Link to={`/acompanhamento?lista=${l.id}`} className="mt-3 inline-block text-sm font-semibold text-azul-600 hover:underline">Ver contatos e observações →</Link>
              </Card>
            )
          })}
        </div>
      )}

      <ImportarLista open={importar} onClose={() => setImportar(false)} />
    </>
  )
}
