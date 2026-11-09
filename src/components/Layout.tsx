import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { BarChart3, FileSpreadsheet, KeyRound, LogOut, RefreshCw, Users } from 'lucide-react'
import { api } from '../lib/api'
import { useDados } from '../lib/dados'
import { cx } from '../lib/utils'
import { Button, Field, Modal } from './ui'

/** Logo completa (símbolo + "Lem Casa — Desde 1995"). */
export function Logo({ className }: { className?: string }) {
  return <img src="/logo.png" alt="Lem Casa" className={cx('h-auto select-none', className)} draggable={false} />
}

function LogoCompact() {
  return (
    <div className="flex items-center gap-2">
      <img src="/mark.png" alt="" className="h-7 w-auto" />
      <div className="leading-none">
        <p className="text-[17px] font-bold tracking-tight text-brand-600">Lem Casa</p>
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-azul-600">Vendas</p>
      </div>
    </div>
  )
}

const navAdmin = [
  { to: '/', label: 'Listas', icon: FileSpreadsheet, end: true },
  { to: '/acompanhamento', label: 'Acompanhamento', icon: BarChart3 },
  { to: '/equipe', label: 'Equipe', icon: Users },
]

function TrocarSenha({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [atual, setAtual] = useState('')
  const [nova, setNova] = useState('')
  const [msg, setMsg] = useState<{ ok: boolean; t: string }>()
  const fechar = () => {
    setAtual('')
    setNova('')
    setMsg(undefined)
    onClose()
  }
  const salvar = async () => {
    try {
      await api('trocarSenha', { atual, nova })
      setMsg({ ok: true, t: 'Senha trocada.' })
      setAtual('')
      setNova('')
    } catch (e) {
      setMsg({ ok: false, t: (e as Error).message })
    }
  }
  return (
    <Modal open={open} onClose={fechar} title="Trocar minha senha" footer={<><Button variant="ghost" onClick={fechar}>Fechar</Button><Button onClick={salvar} disabled={!atual || nova.length < 6}>Salvar</Button></>}>
      <div className="space-y-3">
        <Field label="Senha atual"><input className="input" type="password" autoComplete="current-password" value={atual} onChange={(e) => setAtual(e.target.value)} /></Field>
        <Field label="Nova senha (mínimo 6 caracteres)"><input className="input" type="password" autoComplete="new-password" value={nova} onChange={(e) => setNova(e.target.value)} /></Field>
        {msg && <p className={cx('text-sm', msg.ok ? 'text-verde-700' : 'text-red-600')}>{msg.t}</p>}
      </div>
    </Modal>
  )
}

export function Layout({ onSair }: { onSair: () => void }) {
  const { dados, recarregar } = useDados()
  const [senha, setSenha] = useState(false)
  const [girando, setGirando] = useState(false)
  const admin = dados.eu.papel !== 'vendedora'

  const atualizar = async () => {
    setGirando(true)
    await recarregar()
    setGirando(false)
  }

  const conta = (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
      <button onClick={atualizar} className="flex items-center gap-1 hover:text-brand-600" title="Buscar novidades">
        <RefreshCw size={13} className={girando ? 'animate-spin' : ''} /> Atualizar
      </button>
      <button onClick={() => setSenha(true)} className="flex items-center gap-1 hover:text-brand-600"><KeyRound size={13} /> Senha</button>
      <button onClick={onSair} className="flex items-center gap-1 hover:text-brand-600"><LogOut size={13} /> Sair</button>
    </div>
  )

  return (
    <div className="min-h-screen md:flex">
      {admin && (
        <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-slate-200/80 bg-white md:flex">
          <div className="h-1 bg-brand-gradient" />
          <div className="flex flex-col items-center px-6 pb-5 pt-6">
            <Logo className="w-28" />
            <span className="mt-3 rounded-full bg-azul-50 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-azul-700">Painel de vendas</span>
          </div>
          <nav className="flex flex-1 flex-col gap-0.5 px-3">
            {navAdmin.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  cx('relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] transition', isActive ? 'bg-brand-50 font-semibold text-brand-600' : 'text-slate-500 hover:bg-slate-50 hover:text-brand-600')
                }
              >
                {({ isActive }) => (
                  <>
                    {isActive && <span className="absolute bottom-2 left-0 top-2 w-1 rounded-r-full bg-brand-gradient" />}
                    <Icon size={18} className={isActive ? 'text-azul-500' : ''} /> {label}
                  </>
                )}
              </NavLink>
            ))}
          </nav>
          <div className="m-3 space-y-2 rounded-xl bg-slate-50 p-3">
            <p className="text-sm font-semibold text-brand-600">{dados.eu.nome}</p>
            {conta}
          </div>
        </aside>
      )}

      <header className={cx('sticky top-0 z-30 border-b border-slate-200/80 bg-white/95 backdrop-blur', admin && 'md:hidden')}>
        <div className="h-0.5 bg-brand-gradient" />
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-2 px-4 py-2.5">
          <LogoCompact />
          <div className="text-right">
            <p className="text-sm font-semibold text-brand-600">{dados.eu.nome}</p>
            {conta}
          </div>
        </div>
      </header>

      <main className={cx('min-w-0 flex-1 px-4 pt-5 sm:px-6', admin ? 'pb-[calc(6rem+env(safe-area-inset-bottom))] md:pb-10 lg:px-10 lg:pt-8' : 'mx-auto max-w-3xl pb-10')}>
        <Outlet />
      </main>

      {admin && (
        <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-3 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
          {navAdmin.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) => cx('flex flex-col items-center gap-0.5 py-2 text-[11px]', isActive ? 'font-semibold text-brand-600' : 'text-slate-400')}>
              <Icon size={19} />
              {label}
            </NavLink>
          ))}
        </nav>
      )}

      <TrocarSenha open={senha} onClose={() => setSenha(false)} />
    </div>
  )
}
