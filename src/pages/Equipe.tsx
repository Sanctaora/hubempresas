import { useEffect, useState } from 'react'
import { Copy, KeyRound } from 'lucide-react'
import { api } from '../lib/api'
import { useDados } from '../lib/dados'
import type { Config, Membro } from '../lib/tipos'
import { cx } from '../lib/utils'
import { Badge, Button, Card, Modal, PageHeader } from '../components/ui'

const situacao = (m: Membro) =>
  !m.ativo
    ? { t: m.temSenha ? 'Desativado' : 'Sem acesso ainda', cls: 'bg-slate-100 text-slate-500' }
    : m.trocarSenha
      ? { t: 'Aguardando 1º acesso', cls: 'bg-amber-50 text-amber-700' }
      : { t: 'Ativo', cls: 'bg-verde-50 text-verde-700' }

function Linha({ m, souDono, souGerente, onSenha }: { m: Membro; souDono: boolean; souGerente: boolean; onSenha: (m: Membro, senha: string) => void }) {
  const { setDados } = useDados()
  const [nome, setNome] = useState(m.nome)
  const [usuario, setUsuario] = useState(m.usuario)
  const [erro, setErro] = useState<string>()
  const [ocupado, setOcupado] = useState(false)
  useEffect(() => { setNome(m.nome); setUsuario(m.usuario) }, [m.nome, m.usuario])

  const troca = (membro: Membro) => setDados((d) => ({ ...d, equipe: d.equipe?.map((x) => (x.vaga === membro.vaga ? membro : x)), eu: d.eu.vaga === membro.vaga ? { ...d.eu, ...membro } : d.eu }))
  const rodar = async (f: () => Promise<void>) => {
    setErro(undefined)
    setOcupado(true)
    try {
      await f()
    } catch (e) {
      setErro((e as Error).message)
    }
    setOcupado(false)
  }
  const salvar = () => rodar(async () => troca((await api<{ membro: Membro }>('salvarMembro', { vaga: m.vaga, nome, usuario })).membro))
  const ativar = (ativo: boolean) => rodar(async () => troca((await api<{ membro: Membro }>('salvarMembro', { vaga: m.vaga, ativo })).membro))
  const gerar = () =>
    rodar(async () => {
      if (m.ativo && !m.trocarSenha && !confirm(`Gerar uma nova senha para ${m.nome}? A senha atual dela para de funcionar.`)) return
      const r = await api<{ senha: string; membro: Membro }>('gerarSenha', { vaga: m.vaga })
      troca(r.membro)
      onSenha(r.membro, r.senha)
    })

  const sujo = nome !== m.nome || usuario !== m.usuario
  const s = situacao(m)
  const podeSenha = m.vaga !== 'dono' && (souDono || (souGerente && m.papel === 'vendedora'))
  const papel = m.papel === 'dono' ? 'Dono' : m.papel === 'gerente' ? 'Gerente' : 'Vendedora'

  return (
    <div className="rounded-xl border border-slate-200 p-3">
      <div className="mb-2 flex items-center gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{papel}</span>
        <Badge className={s.cls}>{s.t}</Badge>
      </div>
      <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
        <input className="input" value={nome} disabled={!souDono} onChange={(e) => setNome(e.target.value)} placeholder="Nome" aria-label="Nome" />
        <input className="input" value={usuario} disabled={!souDono} onChange={(e) => setUsuario(e.target.value.toLowerCase().replace(/\s/g, ''))} placeholder="usuário (ex.: ana)" aria-label="Usuário" autoCapitalize="none" />
        <div className="flex flex-wrap gap-1.5">
          {souDono && sujo && <Button onClick={() => void salvar()} disabled={ocupado}>Salvar</Button>}
          {podeSenha && !sujo && (
            <Button variant="secondary" onClick={() => void gerar()} disabled={ocupado || !m.usuario} title={m.usuario ? '' : 'Defina o usuário e salve primeiro'}>
              <KeyRound size={14} /> {m.temSenha ? 'Nova senha' : 'Criar acesso'}
            </Button>
          )}
          {souDono && m.vaga !== 'dono' && m.temSenha && !sujo && (
            <Button variant="ghost" onClick={() => void ativar(!m.ativo)} disabled={ocupado}>{m.ativo ? 'Desativar' : 'Reativar'}</Button>
          )}
        </div>
      </div>
      {m.vaga === 'dono' && <p className="mt-1.5 text-xs text-slate-500">Sua senha de primeiro acesso vem da Vercel (DONO_SENHA_INICIAL). Para trocar a sua senha, use “Senha” no menu.</p>}
      {erro && <p className="mt-1.5 text-xs text-red-600">{erro}</p>}
    </div>
  )
}

function Checklist() {
  const { dados, setDados } = useDados()
  const [texto, setTexto] = useState(dados.config.checklist.join('\n'))
  const [msg, setMsg] = useState<{ ok: boolean; t: string }>()
  const sujo = texto.trim() !== dados.config.checklist.join('\n')
  const salvar = async () => {
    try {
      const { config } = await api<{ config: Config }>('salvarConfig', { checklist: texto.split('\n') })
      setDados((d) => ({ ...d, config }))
      setTexto(config.checklist.join('\n'))
      setMsg({ ok: true, t: 'Checklist salvo.' })
    } catch (e) {
      setMsg({ ok: false, t: (e as Error).message })
    }
  }
  return (
    <Card title="Itens do checklist">
      <p className="mb-2 text-sm text-slate-500">Um item por linha. Vale para todos os contatos. Se você mudar o texto de um item, as marcações antigas dele somem.</p>
      <textarea className="input min-h-[150px]" value={texto} onChange={(e) => { setTexto(e.target.value); setMsg(undefined) }} />
      <div className="mt-2 flex items-center justify-end gap-3">
        {msg && <span className={cx('text-sm', msg.ok ? 'text-verde-700' : 'text-red-600')}>{msg.t}</span>}
        <Button onClick={() => void salvar()} disabled={!sujo}>Salvar checklist</Button>
      </div>
    </Card>
  )
}

export default function Equipe() {
  const { dados } = useDados()
  const [nova, setNova] = useState<{ m: Membro; senha: string }>()
  const [copiado, setCopiado] = useState(false)
  const souDono = dados.eu.papel === 'dono'
  const mensagem = nova && `Seu acesso ao painel de vendas da LEM CASA:\n${location.origin}\nUsuário: ${nova.m.usuario}\nSenha de primeiro acesso: ${nova.senha}\n(No primeiro login você cria a sua senha.)`

  const copiar = async () => {
    await navigator.clipboard.writeText(mensagem!)
    setCopiado(true)
  }

  return (
    <>
      <PageHeader title="Equipe" subtitle={souDono ? 'Os 7 acessos fixos: defina nome e usuário e crie a senha de primeiro acesso' : 'Gere uma nova senha se uma vendedora esquecer a dela'} />
      <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <Card title="Acessos">
          <div className="space-y-2">
            {(dados.equipe ?? []).map((m) => (
              <Linha key={m.vaga} m={m} souDono={souDono} souGerente={dados.eu.papel === 'gerente'} onSenha={(mm, senha) => { setCopiado(false); setNova({ m: mm, senha }) }} />
            ))}
          </div>
        </Card>
        <div><Checklist /></div>
      </div>

      <Modal
        open={Boolean(nova)}
        onClose={() => setNova(undefined)}
        title={`Acesso de ${nova?.m.nome ?? ''}`}
        footer={<><Button variant="ghost" onClick={() => setNova(undefined)}>Fechar</Button><Button onClick={() => void copiar()}><Copy size={14} /> {copiado ? 'Copiado!' : 'Copiar mensagem'}</Button></>}
      >
        <p className="text-sm text-slate-600">Envie para ela pelo WhatsApp. <b>Esta senha só aparece agora</b>. Se perder, é só gerar outra.</p>
        <div className="mt-3 rounded-xl bg-slate-50 p-4 text-sm">
          <p>Usuário: <b className="font-mono">{nova?.m.usuario}</b></p>
          <p className="mt-1">Senha: <b className="font-mono text-lg tracking-wider text-brand-600">{nova?.senha}</b></p>
        </div>
        <pre className="mt-3 whitespace-pre-wrap rounded-lg border border-slate-200 p-3 text-xs text-slate-600">{mensagem}</pre>
      </Modal>
    </>
  )
}
