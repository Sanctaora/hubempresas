import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { api } from './api'
import type { Contato, Dados, Mudancas } from './tipos'

interface Ctx {
  dados: Dados
  recarregar: () => Promise<void>
  /** Salva no servidor e já mostra a mudança na tela. */
  salvarContato: (c: Contato, m: Mudancas) => Promise<void>
  setDados: (f: (d: Dados) => Dados) => void
}

const DadosCtx = createContext<Ctx | null>(null)
export const useDados = () => useContext(DadosCtx)!

const ATUALIZAR_A_CADA = 3 * 60_000

export function DadosProvider({ children, onSair }: { children: ReactNode; onSair: () => void }) {
  const [dados, setDadosState] = useState<Dados>()
  const [erro, setErro] = useState<string>()
  const salvando = useRef(0)

  const recarregar = useCallback(async () => {
    // Não sobrescreve a tela no meio de um salvamento
    if (salvando.current) return
    try {
      setDadosState(await api<Dados>('dados'))
      setErro(undefined)
    } catch (e) {
      if ((e as { status?: number }).status === 401) onSair()
      else setErro((e as Error).message)
    }
  }, [onSair])

  useEffect(() => {
    void recarregar()
    const t = setInterval(() => document.visibilityState === 'visible' && void recarregar(), ATUALIZAR_A_CADA)
    const aoVoltar = () => document.visibilityState === 'visible' && void recarregar()
    document.addEventListener('visibilitychange', aoVoltar)
    return () => {
      clearInterval(t)
      document.removeEventListener('visibilitychange', aoVoltar)
    }
  }, [recarregar])

  const setDados = useCallback((f: (d: Dados) => Dados) => setDadosState((d) => (d ? f(d) : d)), [])

  const salvarContato = useCallback(
    async (c: Contato, m: Mudancas) => {
      const troca = (novo: Contato) => setDados((d) => ({ ...d, contatos: d.contatos.map((x) => (x.id === novo.id ? novo : x)) }))
      troca({ ...c, ...m, retorno: m.retorno === '' ? undefined : (m.retorno ?? c.retorno) })
      salvando.current++
      try {
        const { contato } = await api<{ contato: Contato }>('atualizarContato', { listaId: c.listaId, id: c.id, mudancas: m })
        troca(contato)
      } catch (e) {
        troca(c)
        throw e
      } finally {
        salvando.current--
      }
    },
    [setDados],
  )

  if (!dados)
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 p-6 text-center text-sm text-slate-500">
        {erro ? <><p className="text-red-600">{erro}</p><button className="font-semibold text-azul-600" onClick={() => void recarregar()}>Tentar de novo</button></> : 'Carregando…'}
      </div>
    )
  return <DadosCtx.Provider value={{ dados, recarregar, salvarContato, setDados }}>{children}</DadosCtx.Provider>
}
