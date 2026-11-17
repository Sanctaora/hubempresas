import { useState, type FormEvent, type ReactNode } from 'react'
import { api } from '../lib/api'
import type { Membro } from '../lib/tipos'
import { Logo } from '../components/Layout'
import { Button, Field } from '../components/ui'

function Moldura({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-azul-50 via-white to-verde-50 p-4">
      <div className="w-full max-w-sm overflow-hidden rounded-3xl border border-slate-200/70 bg-white shadow-xl shadow-brand-600/5">
        <div className="h-1.5 bg-brand-gradient" />
        <div className="p-7">
          <div className="flex justify-center">
            <Logo className="w-40" />
          </div>
          {children}
        </div>
      </div>
    </div>
  )
}

export function Login({ onEntrar }: { onEntrar: (m: Membro) => void }) {
  const [usuario, setUsuario] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState<string>()
  const [enviando, setEnviando] = useState(false)

  const entrar = async (e: FormEvent) => {
    e.preventDefault()
    setEnviando(true)
    setErro(undefined)
    try {
      onEntrar((await api<{ eu: Membro }>('login', { usuario, senha })).eu)
    } catch (e) {
      setErro((e as Error).message)
      setEnviando(false)
    }
  }

  return (
    <Moldura>
      <p className="mt-5 text-center text-sm text-slate-500">Painel de vendas · entre com seu usuário</p>
      <form onSubmit={entrar} className="mt-5 space-y-3">
        <Field label="Usuário">
          <input className="input" autoCapitalize="none" autoCorrect="off" autoComplete="username" value={usuario} onChange={(e) => setUsuario(e.target.value)} />
        </Field>
        <Field label="Senha">
          <input className="input" type="password" autoComplete="current-password" value={senha} onChange={(e) => setSenha(e.target.value)} />
        </Field>
        <Button className="w-full py-2.5" disabled={enviando || !usuario || !senha}>{enviando ? 'Entrando…' : 'Entrar'}</Button>
        {erro && <p className="text-center text-xs text-red-600">{erro}</p>}
      </form>
      <EsqueciSenha usuarioDigitado={usuario} />
    </Moldura>
  )
}

/** Pede senha nova: avisa a gerente no painel, que gera e manda pelo WhatsApp. */
function EsqueciSenha({ usuarioDigitado }: { usuarioDigitado: string }) {
  const [aberto, setAberto] = useState(false)
  const [usuario, setUsuario] = useState('')
  const [estado, setEstado] = useState<'enviando' | 'pronto'>()
  const [erro, setErro] = useState<string>()

  const pedir = async (e: FormEvent) => {
    e.preventDefault()
    setEstado('enviando')
    setErro(undefined)
    try {
      await api('pedirSenha', { usuario })
      setEstado('pronto')
    } catch (e) {
      setErro((e as Error).message)
      setEstado(undefined)
    }
  }

  if (estado === 'pronto')
    return (
      <div className="mt-5 rounded-xl bg-verde-50 p-3 text-center text-sm text-verde-700">
        <b>Pedido enviado!</b> A gerente foi avisada e vai te mandar uma senha nova pelo WhatsApp.
      </div>
    )
  if (!aberto)
    return (
      <button onClick={() => { setUsuario(usuarioDigitado); setAberto(true) }} className="mt-5 w-full text-center text-sm font-semibold text-azul-600 hover:underline">
        Esqueci a senha
      </button>
    )
  return (
    <form onSubmit={pedir} className="mt-5 space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
      <p className="text-sm text-slate-600">Digite o seu usuário. A gerente recebe o aviso e te manda uma senha nova pelo WhatsApp.</p>
      <input className="input" autoCapitalize="none" autoCorrect="off" placeholder="seu usuário" value={usuario} onChange={(e) => setUsuario(e.target.value)} />
      <div className="flex gap-2">
        <Button type="button" variant="ghost" className="flex-1" onClick={() => setAberto(false)}>Voltar</Button>
        <Button className="flex-1" disabled={!usuario.trim() || estado === 'enviando'}>{estado === 'enviando' ? 'Enviando…' : 'Pedir senha nova'}</Button>
      </div>
      {erro && <p className="text-center text-xs text-red-600">{erro}</p>}
    </form>
  )
}

export function PrimeiroAcesso({ eu, onPronto, onSair }: { eu: Membro; onPronto: (m: Membro) => void; onSair: () => void }) {
  const [nova, setNova] = useState('')
  const [repete, setRepete] = useState('')
  const [erro, setErro] = useState<string>()
  const [enviando, setEnviando] = useState(false)

  const salvar = async (e: FormEvent) => {
    e.preventDefault()
    if (nova !== repete) return setErro('As duas senhas não são iguais.')
    setEnviando(true)
    setErro(undefined)
    try {
      onPronto((await api<{ eu: Membro }>('trocarSenha', { nova })).eu)
    } catch (e) {
      setErro((e as Error).message)
      setEnviando(false)
    }
  }

  return (
    <Moldura>
      <h1 className="mt-5 text-center text-lg font-bold text-brand-600">Olá, {eu.nome.split(' ')[0]}!</h1>
      <p className="mt-1 text-center text-sm text-slate-500">Primeiro acesso: crie a sua senha. A senha que você recebeu deixa de valer.</p>
      <form onSubmit={salvar} className="mt-5 space-y-3">
        <Field label="Nova senha (mínimo 6 caracteres)">
          <input className="input" type="password" autoComplete="new-password" value={nova} onChange={(e) => setNova(e.target.value)} />
        </Field>
        <Field label="Repita a nova senha">
          <input className="input" type="password" autoComplete="new-password" value={repete} onChange={(e) => setRepete(e.target.value)} />
        </Field>
        <Button className="w-full py-2.5" disabled={enviando || nova.length < 6 || !repete}>{enviando ? 'Salvando…' : 'Salvar e entrar'}</Button>
        {erro && <p className="text-center text-xs text-red-600">{erro}</p>}
      </form>
      <button onClick={onSair} className="mt-4 w-full text-center text-xs text-slate-400 hover:text-brand-600">Sair</button>
    </Moldura>
  )
}
