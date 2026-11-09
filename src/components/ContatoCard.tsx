import { useEffect, useState } from 'react'
import { Check, ChevronDown, MessageCircle, Phone } from 'lucide-react'
import { useDados } from '../lib/dados'
import type { Contato, Membro, Mudancas, Vaga } from '../lib/tipos'
import { cx, dataBr, dataHora, hoje, linkLigar, linkWhats, ORDEM_STATUS, STATUS, VENDEDORAS } from '../lib/utils'
import { Badge } from './ui'

export function ContatoCard({ contato: c, listaNome, equipe, aberto, onAbrir }: { contato: Contato; listaNome?: string; equipe?: Membro[]; aberto: boolean; onAbrir: () => void }) {
  const { dados, salvarContato } = useDados()
  const itens = dados.config.checklist
  const [obs, setObs] = useState(c.obs)
  const [erro, setErro] = useState<string>()
  const [salvo, setSalvo] = useState(false)
  useEffect(() => setObs(c.obs), [c.obs])

  const feitos = itens.filter((i) => c.checklist[i]).length
  const atrasado = c.retorno && c.retorno <= hoje() && !STATUS[c.status].final
  const whats = linkWhats(c.telefone)
  const ligar = linkLigar(c.telefone)
  const extras = Object.entries(c.dados).filter(([, v]) => v)
  const nomeVendedora = (v: Vaga) => equipe?.find((m) => m.vaga === v)?.nome ?? v

  const salvar = async (m: Mudancas) => {
    setErro(undefined)
    try {
      // Mexer no checklist de um contato não iniciado já o coloca em andamento
      if (m.checklist && c.status === 'pendente' && !m.status) m = { ...m, status: 'andamento' }
      await salvarContato(c, m)
      setSalvo(true)
      setTimeout(() => setSalvo(false), 1500)
    } catch (e) {
      setErro((e as Error).message)
    }
  }
  const salvarObs = () => obs !== c.obs && void salvar({ obs })

  return (
    <div className={cx('rounded-xl border bg-white shadow-sm transition', aberto ? 'border-azul-200 ring-1 ring-azul-100' : 'border-slate-200')}>
      <button onClick={onAbrir} className="flex w-full items-start gap-3 p-3 text-left">
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-slate-800">{c.nome || 'Sem nome'}</p>
          <p className="text-sm tabular-nums text-slate-500">{c.telefone || 'Sem telefone'}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <Badge className={STATUS[c.status].cls}>{STATUS[c.status].label}</Badge>
            <span className={cx('text-[11px] tabular-nums', feitos === itens.length ? 'text-verde-700' : 'text-slate-500')}>✓ {feitos}/{itens.length}</span>
            {c.retorno && !STATUS[c.status].final && (
              <span className={cx('text-[11px]', atrasado ? 'font-semibold text-red-600' : 'text-amber-700')}>retornar {dataBr(c.retorno)}</span>
            )}
            {equipe && <span className="text-[11px] text-slate-500">· {nomeVendedora(c.vendedora)}</span>}
            {listaNome && <span className="truncate text-[11px] text-slate-400">· {listaNome}</span>}
          </div>
          {!aberto && c.obs && <p className="mt-1 line-clamp-1 text-xs italic text-slate-500">“{c.obs}”</p>}
        </div>
        <ChevronDown size={18} className={cx('mt-1 shrink-0 text-slate-400 transition', aberto && 'rotate-180')} />
      </button>

      {aberto && (
        <div className="space-y-4 border-t border-slate-100 px-3 pb-3 pt-3">
          <div className="flex gap-2">
            {whats && (
              <a href={whats} target="_blank" rel="noreferrer" className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-verde-600 px-3 py-2 text-sm font-semibold text-white hover:bg-verde-700">
                <MessageCircle size={16} /> WhatsApp
              </a>
            )}
            {ligar && (
              <a href={ligar} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-brand-600 hover:bg-azul-50">
                <Phone size={16} /> Ligar
              </a>
            )}
          </div>

          {extras.length > 0 && (
            <dl className="grid grid-cols-1 gap-x-4 gap-y-1 rounded-lg bg-slate-50 p-2.5 text-xs sm:grid-cols-2">
              {extras.map(([k, v]) => (
                <div key={k} className="flex gap-1.5">
                  <dt className="shrink-0 font-semibold text-slate-500">{k}:</dt>
                  <dd className="break-words text-slate-700">{v}</dd>
                </div>
              ))}
            </dl>
          )}

          <div>
            <p className="label">Checklist</p>
            <div className="space-y-1">
              {itens.map((i) => {
                const marcado = Boolean(c.checklist[i])
                return (
                  <button
                    key={i}
                    onClick={() => void salvar({ checklist: { ...c.checklist, [i]: !marcado } })}
                    className={cx('flex w-full items-center gap-2.5 rounded-lg border px-2.5 py-2 text-left text-sm transition', marcado ? 'border-verde-200 bg-verde-50 text-verde-700' : 'border-slate-200 hover:bg-slate-50')}
                  >
                    <span className={cx('flex h-5 w-5 shrink-0 items-center justify-center rounded-md border', marcado ? 'border-verde-600 bg-verde-600 text-white' : 'border-slate-300 bg-white')}>
                      {marcado && <Check size={14} strokeWidth={3} />}
                    </span>
                    {i}
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <p className="label">Como ficou</p>
            <div className="flex flex-wrap gap-1.5">
              {ORDEM_STATUS.map((s) => (
                <button
                  key={s}
                  onClick={() => void salvar({ status: s })}
                  className={cx('rounded-full border px-3 py-1.5 text-xs font-medium transition', c.status === s ? cx(STATUS[s].cls, 'border-current') : 'border-slate-200 text-slate-500 hover:bg-slate-50')}
                >
                  {STATUS[s].label}
                </button>
              ))}
            </div>
          </div>

          <label className="block">
            <span className="label">Retornar em (opcional)</span>
            <input type="date" className="input w-auto" value={c.retorno ?? ''} onChange={(e) => void salvar({ retorno: e.target.value, ...(e.target.value && c.status === 'pendente' ? { status: 'retornar' as const } : {}) })} />
          </label>

          <label className="block">
            <span className="label">Observação: o que aconteceu?</span>
            <textarea className="input min-h-[90px]" value={obs} onChange={(e) => setObs(e.target.value)} onBlur={salvarObs} placeholder="Ex.: pediu fotos do jogo de cama queen, vai ver com o marido e retorna sexta." />
          </label>

          {equipe && (
            <label className="block">
              <span className="label">Vendedora responsável</span>
              <select className="input w-auto" value={c.vendedora} onChange={(e) => void salvar({ vendedora: e.target.value as Vaga })}>
                {VENDEDORAS.map((v) => <option key={v} value={v}>{nomeVendedora(v)}</option>)}
              </select>
            </label>
          )}

          <div className="flex min-h-[20px] items-center justify-between gap-2 text-xs">
            <span className="text-slate-400">{c.atualizadoEm ? `Atualizado ${dataHora(c.atualizadoEm)}` : ''}</span>
            {erro ? <span className="text-red-600">{erro}</span> : salvo ? <span className="font-semibold text-verde-700">Salvo ✓</span> : obs !== c.obs ? (
              <button onClick={salvarObs} className="font-semibold text-azul-600">Salvar observação</button>
            ) : null}
          </div>
        </div>
      )}
    </div>
  )
}
