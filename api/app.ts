/**
 * Servidor do painel de vendas: login, equipe, listas e contatos.
 * Tudo passa por /api/app?acao=<nome> (POST com JSON). Os dados ficam no Upstash Redis
 * conectado em Vercel → Storage; sem ele (no computador) ficam em .dados-dev.json.
 *
 * Variáveis de ambiente (Vercel → Settings → Environment Variables):
 *   DONO_USUARIO         opcional: seu usuário de login (padrão: eduardo)
 *   DONO_SENHA_INICIAL   sua senha de primeiro acesso (o painel pede para trocar no primeiro login)
 *   KV_REST_API_URL / KV_REST_API_TOKEN   criadas pela Vercel ao conectar o Upstash Redis
 */
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Config, Contato, Dados, Lista, Membro, Mudancas, Status, Vaga } from '../src/lib/tipos'

const env = process.env
const VAGAS: Vaga[] = ['dono', 'gerente', 'v1', 'v2', 'v3', 'v4', 'v5']
const VENDEDORAS: Vaga[] = ['v1', 'v2', 'v3', 'v4', 'v5']
const STATUS: Status[] = ['pendente', 'andamento', 'retornar', 'vendeu', 'sem_interesse', 'sem_contato']
const SESSAO_DIAS = 30
const CHECKLIST_PADRAO = ['Mensagem enviada no WhatsApp', 'Cliente respondeu', 'Enviou fotos / catálogo', 'Orçamento enviado', 'Pós-venda feito']

// ---------- Armazenamento ----------

interface Kv {
  get<T>(k: string): Promise<T | null>
  set(k: string, v: unknown, ttlSeg?: number): Promise<void>
  del(k: string): Promise<void>
  hgetall<T>(k: string): Promise<Record<string, T>>
  hget<T>(k: string, campo: string): Promise<T | null>
  hset(k: string, valores: Record<string, unknown>): Promise<void>
  incr(k: string, ttlSeg: number): Promise<number>
}

async function upstash(url: string, token: string): Promise<Kv> {
  const { Redis } = await import('@upstash/redis')
  const r = new Redis({ url, token })
  return {
    get: (k) => r.get(k),
    set: async (k, v, ttl) => void (ttl ? await r.set(k, v, { ex: ttl }) : await r.set(k, v)),
    del: async (k) => void (await r.del(k)),
    hgetall: async <T,>(k: string) => ((await r.hgetall(k)) ?? {}) as Record<string, T>,
    hget: (k, c) => r.hget(k, c),
    hset: async (k, v) => void (await r.hset(k, v)),
    incr: async (k, ttl) => {
      const n = await r.incr(k)
      if (n === 1) await r.expire(k, ttl)
      return n
    },
  }
}

/** Para rodar no computador sem Redis: guarda tudo num arquivo JSON. */
async function arquivoLocal(): Promise<Kv> {
  const fs = await import('node:fs')
  const caminho = `${process.cwd()}/.dados-dev.json`
  const g = globalThis as { __kv?: Record<string, { v: unknown; exp?: number }> }
  if (!g.__kv) g.__kv = fs.existsSync(caminho) ? JSON.parse(fs.readFileSync(caminho, 'utf8')) : {}
  const m = g.__kv!
  const salvar = () => fs.writeFileSync(caminho, JSON.stringify(m))
  const ler = (k: string) => {
    const e = m[k]
    if (e?.exp && e.exp < Date.now()) delete m[k]
    return m[k]?.v
  }
  const copia = <T,>(v: unknown) => (v === undefined ? null : (JSON.parse(JSON.stringify(v)) as T))
  return {
    get: async (k) => copia(ler(k)),
    set: async (k, v, ttl) => {
      m[k] = { v: copia(v), exp: ttl ? Date.now() + ttl * 1000 : undefined }
      salvar()
    },
    del: async (k) => {
      delete m[k]
      salvar()
    },
    hgetall: async <T,>(k: string) => copia<Record<string, T>>(ler(k) ?? {})!,
    hget: async (k, c) => copia((ler(k) as Record<string, unknown> | undefined)?.[c]),
    hset: async (k, v) => {
      m[k] = { v: { ...((ler(k) as object) ?? {}), ...copia<object>(v) } }
      salvar()
    },
    incr: async (k, ttl) => {
      const n = ((ler(k) as number) ?? 0) + 1
      m[k] = { v: n, exp: m[k]?.exp ?? Date.now() + ttl * 1000 }
      salvar()
      return n
    },
  }
}

let kvPronto: Promise<Kv> | undefined
function kv() {
  const url = env.KV_REST_API_URL || env.UPSTASH_REDIS_REST_URL
  const token = env.KV_REST_API_TOKEN || env.UPSTASH_REDIS_REST_TOKEN
  if (!kvPronto) {
    if (url && token) kvPronto = upstash(url, token)
    else if (env.VERCEL) throw new Erro(500, 'Banco não conectado: na Vercel, vá em Storage → Upstash Redis e conecte a este projeto.')
    else kvPronto = arquivoLocal()
  }
  return kvPronto
}

// ---------- Equipe e senhas ----------

interface MembroSalvo extends Omit<Membro, 'temSenha'> {
  senha?: string // "sal:hash" (scrypt)
  /** Muda ao trocar a senha de primeiro acesso ou desativar: derruba os logins antigos. */
  versao: number
}

class Erro extends Error {
  constructor(public status: number, msg: string) {
    super(msg)
  }
}

const usuarioDono = () => (env.DONO_USUARIO || 'eduardo').trim().toLowerCase()

/** Equipe atual; nomes e usuários podem ser trocados depois na tela Equipe. */
const NOMES: Record<Vaga, [nome: string, usuario: string]> = {
  dono: ['Eduardo Manso', ''],
  gerente: ['Renata', 'renata'],
  v1: ['Michelli', 'michelli'],
  v2: ['Luna', 'luna'],
  v3: ['Raquel', 'raquel'],
  v4: ['Milleny', 'milleny'],
  v5: ['Jane', 'jane'],
}

function equipePadrao(): Record<Vaga, MembroSalvo> {
  return Object.fromEntries(
    VAGAS.map((v) => [
      v,
      {
        vaga: v,
        papel: v === 'dono' ? 'dono' : v === 'gerente' ? 'gerente' : 'vendedora',
        nome: NOMES[v][0],
        usuario: v === 'dono' ? usuarioDono() : NOMES[v][1],
        ativo: v === 'dono',
        trocarSenha: true,
        versao: 1,
      },
    ]),
  ) as Record<Vaga, MembroSalvo>
}

async function carregarEquipe() {
  const salva = await (await kv()).get<Record<Vaga, MembroSalvo>>('equipe')
  const padrao = equipePadrao()
  for (const v of VAGAS) padrao[v] = { ...padrao[v], ...salva?.[v] }
  return padrao
}
const salvarEquipe = async (e: Record<Vaga, MembroSalvo>) => (await kv()).set('equipe', e)

const publico = ({ senha, versao: _v, ...m }: MembroSalvo): Membro => ({
  ...m,
  temSenha: Boolean(senha) || (m.vaga === 'dono' && Boolean(env.DONO_SENHA_INICIAL)),
})

const hashSenha = (senha: string) => {
  const sal = randomBytes(16).toString('hex')
  return `${sal}:${scryptSync(senha, sal, 32).toString('hex')}`
}

function confere(senha: string, salvo: string) {
  const [sal, hash] = salvo.split(':')
  const a = scryptSync(senha, sal, 32)
  const b = Buffer.from(hash, 'hex')
  return a.length === b.length && timingSafeEqual(a, b)
}

const iguais = (a: string, b: string) => {
  const x = Buffer.from(a)
  const y = Buffer.from(b)
  return x.length === y.length && timingSafeEqual(x, y)
}

/** Senha de primeiro acesso fácil de ditar: sem letras parecidas (l/1, o/0). */
function senhaProvisoria() {
  const letras = 'abcdefghjkmnpqrstuvwxyz23456789'
  return Array.from(randomBytes(8), (b) => letras[b % letras.length]).join('')
}

// ---------- Sessão ----------

function lerCookie(req: IncomingMessage, nome: string) {
  const m = (req.headers.cookie ?? '').match(new RegExp(`(?:^|;\\s*)${nome}=([^;]+)`))
  return m?.[1]
}

function cookieSessao(req: IncomingMessage, valor: string, maxAge: number) {
  const https = req.headers['x-forwarded-proto'] === 'https' || Boolean(env.VERCEL)
  return `sessao=${valor}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${https ? '; Secure' : ''}`
}

async function quemEsta(req: IncomingMessage) {
  const token = lerCookie(req, 'sessao')
  if (!token) throw new Erro(401, 'Entre para continuar.')
  const s = await (await kv()).get<{ vaga: Vaga; versao: number }>(`sess:${token}`)
  const equipe = await carregarEquipe()
  const m = s && equipe[s.vaga]
  if (!m || !m.ativo || m.versao !== s.versao) throw new Erro(401, 'Sua sessão terminou. Entre de novo.')
  return { eu: m, equipe, token }
}

const ehAdmin = (m: MembroSalvo) => m.papel === 'dono' || m.papel === 'gerente'
function exigeAdmin(m: MembroSalvo) {
  if (!ehAdmin(m)) throw new Erro(403, 'Só o dono e a gerente podem fazer isso.')
}

// ---------- Listas e contatos ----------

const chaveContatos = (listaId: string) => `c:${listaId}`
const novoId = () => randomBytes(6).toString('base64url')
const texto = (v: unknown, max: number) => String(v ?? '').trim().slice(0, max)

async function carregarListas() {
  return (await (await kv()).get<Lista[]>('listas')) ?? []
}

async function carregarConfig(): Promise<Config> {
  return (await (await kv()).get<Config>('config')) ?? { checklist: CHECKLIST_PADRAO }
}

async function contatosDe(listas: Lista[], vaga?: Vaga) {
  const store = await kv()
  const visiveis = vaga ? listas.filter((l) => (l.porVendedora[vaga] ?? 0) > 0) : listas
  const porLista = await Promise.all(visiveis.map((l) => store.hgetall<Contato>(chaveContatos(l.id))))
  const todos = porLista.flatMap((h) => Object.values(h))
  return { listas: visiveis, contatos: vaga ? todos.filter((c) => c.vendedora === vaga) : todos }
}

function aplicarMudancas(c: Contato, m: Mudancas) {
  if (m.status !== undefined) {
    if (!STATUS.includes(m.status)) throw new Erro(400, 'Status inválido.')
    c.status = m.status
  }
  if (m.checklist !== undefined) {
    c.checklist = Object.fromEntries(
      Object.entries(m.checklist)
        .slice(0, 30)
        .map(([k, v]) => [texto(k, 200), v === true]),
    )
  }
  if (m.obs !== undefined) c.obs = texto(m.obs, 5000)
  if (m.retorno !== undefined) {
    if (m.retorno && !/^\d{4}-\d{2}-\d{2}$/.test(m.retorno)) throw new Erro(400, 'Data de retorno inválida.')
    c.retorno = m.retorno || undefined
  }
}

// ---------- Ações ----------

type Corpo = Record<string, any>
type Resposta = { body: unknown; cookie?: string }

async function executar(acao: string, b: Corpo, req: IncomingMessage): Promise<Resposta> {
  const store = await kv()

  if (acao === 'login') {
    const usuario = texto(b.usuario, 60).toLowerCase()
    const senha = String(b.senha ?? '')
    if (!usuario || !senha) throw new Erro(400, 'Preencha usuário e senha.')
    if ((await store.incr(`tent:${usuario}`, 15 * 60)) > 10) throw new Erro(429, 'Muitas tentativas. Espere 15 minutos e tente de novo.')

    const equipe = await carregarEquipe()
    const m = Object.values(equipe).find((x) => x.usuario && x.usuario === usuario)
    let ok = false
    if (m?.ativo && m.senha) ok = confere(senha, m.senha)
    else if (m?.vaga === 'dono' && !m.senha && env.DONO_SENHA_INICIAL) ok = iguais(senha, env.DONO_SENHA_INICIAL)
    if (!m || !ok) throw new Erro(401, 'Usuário ou senha incorretos.')

    if (!m.senha) {
      m.senha = hashSenha(senha)
      m.trocarSenha = true
      await salvarEquipe(equipe)
    }
    await store.del(`tent:${usuario}`)
    const token = randomBytes(32).toString('base64url')
    await store.set(`sess:${token}`, { vaga: m.vaga, versao: m.versao }, SESSAO_DIAS * 86400)
    return { body: { eu: publico(m) }, cookie: cookieSessao(req, token, SESSAO_DIAS * 86400) }
  }

  if (acao === 'sair') {
    const token = lerCookie(req, 'sessao')
    if (token) await store.del(`sess:${token}`)
    return { body: { ok: true }, cookie: cookieSessao(req, '', 0) }
  }

  const { eu, equipe } = await quemEsta(req)

  switch (acao) {
    case 'eu':
      return { body: { eu: publico(eu) } }

    case 'trocarSenha': {
      const nova = String(b.nova ?? '')
      if (nova.length < 6) throw new Erro(400, 'A senha precisa ter pelo menos 6 caracteres.')
      if (!eu.trocarSenha && !(eu.senha && confere(String(b.atual ?? ''), eu.senha))) throw new Erro(400, 'Senha atual incorreta.')
      eu.senha = hashSenha(nova)
      eu.trocarSenha = false
      await salvarEquipe(equipe)
      return { body: { eu: publico(eu) } }
    }

    case 'dados': {
      const [config, todas] = await Promise.all([carregarConfig(), carregarListas()])
      const { listas, contatos } = await contatosDe(todas, ehAdmin(eu) ? undefined : eu.vaga)
      const dados: Dados = { eu: publico(eu), config, listas, contatos }
      if (ehAdmin(eu)) dados.equipe = VAGAS.map((v) => publico(equipe[v]))
      return { body: dados }
    }

    case 'criarLista': {
      exigeAdmin(eu)
      const nome = texto(b.nome, 120)
      if (!nome) throw new Erro(400, 'Dê um nome para a lista.')
      const lista: Lista = {
        id: novoId(),
        nome,
        colunas: (Array.isArray(b.colunas) ? b.colunas : []).slice(0, 60).map((c: unknown) => texto(c, 80)),
        criadaEm: new Date().toISOString(),
        criadaPor: eu.vaga,
        total: 0,
        porVendedora: {},
      }
      await store.set('listas', [...(await carregarListas()), lista])
      return { body: { lista } }
    }

    case 'adicionarContatos': {
      exigeAdmin(eu)
      const listas = await carregarListas()
      const lista = listas.find((l) => l.id === b.listaId)
      if (!lista) throw new Erro(404, 'Lista não encontrada.')
      const entrada: Corpo[] = Array.isArray(b.contatos) ? b.contatos : []
      if (entrada.length > 1000) throw new Erro(400, 'Envie no máximo 1000 contatos por vez.')
      const novos: Record<string, Contato> = {}
      for (const e of entrada) {
        if (!VENDEDORAS.includes(e.vendedora)) throw new Erro(400, 'Vendedora inválida.')
        const dados = Object.fromEntries(Object.entries((e.dados ?? {}) as Record<string, unknown>).slice(0, 60).map(([k, v]) => [texto(k, 80), texto(v, 500)]))
        const c: Contato = { id: novoId(), listaId: lista.id, vendedora: e.vendedora, nome: texto(e.nome, 200), telefone: texto(e.telefone, 40), dados, status: 'pendente', checklist: {}, obs: '' }
        novos[c.id] = c
        lista.total++
        lista.porVendedora[c.vendedora] = (lista.porVendedora[c.vendedora] ?? 0) + 1
      }
      if (entrada.length) await store.hset(chaveContatos(lista.id), novos)
      await store.set('listas', listas)
      return { body: { lista } }
    }

    case 'renomearLista': {
      exigeAdmin(eu)
      const listas = await carregarListas()
      const lista = listas.find((l) => l.id === b.id)
      if (!lista) throw new Erro(404, 'Lista não encontrada.')
      lista.nome = texto(b.nome, 120) || lista.nome
      await store.set('listas', listas)
      return { body: { lista } }
    }

    case 'excluirLista': {
      exigeAdmin(eu)
      await store.del(chaveContatos(String(b.id)))
      await store.set('listas', (await carregarListas()).filter((l) => l.id !== b.id))
      return { body: { ok: true } }
    }

    case 'atualizarContato': {
      const chave = chaveContatos(String(b.listaId))
      const c = await store.hget<Contato>(chave, String(b.id))
      if (!c) throw new Erro(404, 'Contato não encontrado (a lista pode ter sido excluída).')
      const m = (b.mudancas ?? {}) as Mudancas
      if (!ehAdmin(eu) && (c.vendedora !== eu.vaga || m.vendedora)) throw new Erro(403, 'Este contato não é seu.')
      aplicarMudancas(c, m)
      if (m.vendedora && m.vendedora !== c.vendedora) {
        if (!VENDEDORAS.includes(m.vendedora)) throw new Erro(400, 'Vendedora inválida.')
        const listas = await carregarListas()
        const lista = listas.find((l) => l.id === c.listaId)
        if (lista) {
          lista.porVendedora[c.vendedora] = Math.max(0, (lista.porVendedora[c.vendedora] ?? 1) - 1)
          lista.porVendedora[m.vendedora] = (lista.porVendedora[m.vendedora] ?? 0) + 1
          await store.set('listas', listas)
        }
        c.vendedora = m.vendedora
      }
      c.atualizadoEm = new Date().toISOString()
      c.atualizadoPor = eu.vaga
      await store.hset(chave, { [c.id]: c })
      return { body: { contato: c } }
    }

    case 'salvarMembro': {
      if (eu.papel !== 'dono') throw new Erro(403, 'Só o dono altera a equipe.')
      const alvo = equipe[b.vaga as Vaga]
      if (!alvo) throw new Erro(404, 'Acesso não encontrado.')
      if (b.nome !== undefined) alvo.nome = texto(b.nome, 60) || alvo.nome
      if (b.usuario !== undefined) {
        const u = texto(b.usuario, 30).toLowerCase()
        if (!/^[a-z0-9._-]{3,30}$/.test(u)) throw new Erro(400, 'Usuário: de 3 a 30 letras minúsculas, números, ponto, hífen ou _ (sem espaço nem acento).')
        if (Object.values(equipe).some((x) => x.vaga !== alvo.vaga && x.usuario === u)) throw new Erro(400, `O usuário "${u}" já está em uso.`)
        alvo.usuario = u
      }
      if (b.ativo !== undefined && alvo.vaga !== 'dono') {
        alvo.ativo = b.ativo === true
        if (!alvo.ativo) alvo.versao++
      }
      await salvarEquipe(equipe)
      return { body: { membro: publico(alvo) } }
    }

    case 'gerarSenha': {
      const alvo = equipe[b.vaga as Vaga]
      if (!alvo || alvo.vaga === 'dono') throw new Erro(404, 'Acesso não encontrado.')
      const pode = eu.papel === 'dono' || (eu.papel === 'gerente' && alvo.papel === 'vendedora')
      if (!pode) throw new Erro(403, 'Você não pode gerar senha para este acesso.')
      if (!alvo.usuario) throw new Erro(400, 'Defina o usuário antes de gerar a senha.')
      const senha = senhaProvisoria()
      alvo.senha = hashSenha(senha)
      alvo.trocarSenha = true
      alvo.ativo = true
      alvo.versao++
      await salvarEquipe(equipe)
      return { body: { senha, membro: publico(alvo) } }
    }

    case 'salvarConfig': {
      exigeAdmin(eu)
      const itens = (Array.isArray(b.checklist) ? b.checklist : []).map((x: unknown) => texto(x, 120)).filter(Boolean).slice(0, 15)
      if (!itens.length) throw new Erro(400, 'Deixe pelo menos um item no checklist.')
      const config: Config = { checklist: [...new Set<string>(itens)] }
      await store.set('config', config)
      return { body: { config } }
    }
  }
  throw new Erro(404, `Ação desconhecida: ${acao}`)
}

// ---------- Handler (formato de função Node da Vercel) ----------

async function lerCorpo(req: IncomingMessage & { body?: unknown }): Promise<Corpo> {
  if (req.body !== undefined) return typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body as Corpo)
  const partes: Buffer[] = []
  for await (const p of req) partes.push(p as Buffer)
  const raw = Buffer.concat(partes).toString('utf8')
  return raw ? JSON.parse(raw) : {}
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const enviar = (status: number, body: unknown, cookie?: string) => {
    res.statusCode = status
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.setHeader('Cache-Control', 'no-store')
    if (cookie) res.setHeader('Set-Cookie', cookie)
    res.end(JSON.stringify(body))
  }
  try {
    if (req.method !== 'POST') return enviar(405, { erro: 'Use POST.' })
    const acao = new URL(req.url ?? '/', 'http://x').searchParams.get('acao') ?? ''
    const { body, cookie } = await executar(acao, await lerCorpo(req), req)
    enviar(200, body, cookie)
  } catch (e) {
    if (e instanceof Erro) enviar(e.status, { erro: e.message })
    else enviar(500, { erro: `Erro no servidor: ${(e as Error).message}` })
  }
}
