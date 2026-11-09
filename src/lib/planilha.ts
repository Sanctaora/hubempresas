import type { Contato, Membro } from './tipos'
import { dataBr, dataHora, semAcento, STATUS } from './utils'

export interface Tabela {
  colunas: string[]
  linhas: Record<string, string>[]
}
export interface Aba {
  nome: string
  tabela: Tabela
}

const celula = (v: unknown) =>
  v == null ? '' : v instanceof Date ? v.toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : String(v).trim()

/** Primeira linha preenchida vira o cabeçalho; linhas totalmente vazias são descartadas. */
export function montarTabela(bruto: unknown[][]): Tabela {
  const linhas = bruto.map((l) => l.map(celula)).filter((l) => l.some(Boolean))
  if (!linhas.length) return { colunas: [], linhas: [] }
  const largura = Math.max(...linhas.map((l) => l.length))
  const usados = new Map<string, number>()
  const colunas = Array.from({ length: largura }, (_, i) => {
    const base = linhas[0][i] || `Coluna ${i + 1}`
    const n = (usados.get(base) ?? 0) + 1
    usados.set(base, n)
    return n > 1 ? `${base} (${n})` : base
  })
  return {
    colunas,
    linhas: linhas.slice(1).map((l) => Object.fromEntries(colunas.map((c, i) => [c, l[i] ?? '']))),
  }
}

/** Texto separado por ; , ou tabulação (CSV, TXT ou colado do Excel). */
export function lerTexto(txt: string): Tabela {
  const primeira = txt.split(/\r?\n/).find((l) => l.trim()) ?? ''
  const sep = ['\t', ';', ','].map((s) => [s, primeira.split(s).length] as const).sort((a, b) => b[1] - a[1])[0][0]
  const linhas: string[][] = []
  let linha: string[] = []
  let campo = ''
  let aspas = false
  for (let i = 0; i < txt.length; i++) {
    const ch = txt[i]
    if (aspas) {
      if (ch === '"' && txt[i + 1] === '"') { campo += '"'; i++ }
      else if (ch === '"') aspas = false
      else campo += ch
    } else if (ch === '"' && !campo) aspas = true
    else if (ch === sep) { linha.push(campo); campo = '' }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && txt[i + 1] === '\n') i++
      linha.push(campo); linhas.push(linha); linha = []; campo = ''
    } else campo += ch
  }
  if (campo || linha.length) { linha.push(campo); linhas.push(linha) }
  return montarTabela(linhas)
}

/** CSV do Excel brasileiro costuma vir em Windows-1252; tenta UTF-8 primeiro. */
function decodificar(buf: ArrayBuffer) {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buf).replace(/^﻿/, '')
  } catch {
    return new TextDecoder('windows-1252').decode(buf)
  }
}

export const FORMATOS = '.xlsx,.csv,.txt,.tsv'

export async function lerArquivo(arquivo: File): Promise<Aba[]> {
  const ext = arquivo.name.split('.').pop()?.toLowerCase()
  if (ext === 'xlsx') {
    const { default: readXlsxFile } = await import('read-excel-file/browser')
    const abas = await readXlsxFile(arquivo)
    return abas.map((a) => ({ nome: a.sheet, tabela: montarTabela(a.data as unknown[][]) })).filter((a) => a.tabela.linhas.length)
  }
  if (ext === 'xls' || ext === 'ods' || ext === 'numbers')
    throw new Error('Esse formato antigo não é lido. No Excel/Planilhas, use "Salvar como" → .xlsx ou .csv e envie de novo.')
  return [{ nome: arquivo.name, tabela: lerTexto(decodificar(await arquivo.arrayBuffer())) }]
}

const pareceTelefone = (v: string) => /^\+?[\d\s().-]{8,}$/.test(v)

/**
 * Adivinha as colunas pelo cabeçalho: nome, telefone principal (WhatsApp de preferência) e um
 * telefone reserva, usado quando o principal está vazio.
 */
export function detectarColunas(colunas: string[], linhas: Record<string, string>[]) {
  const amostra = linhas.slice(0, 40)
  // Coluna "de telefone" precisa ter algum valor com cara de telefone (descarta "Link WhatsApp", "Confirmação WhatsApp")
  const temTelefone = (c: string) => amostra.some((l) => pareceTelefone(l[c] ?? ''))
  const acha = (padroes: RegExp[], filtro: (c: string) => boolean = () => true, fora: string[] = []) => {
    for (const re of padroes) {
      const c = colunas.find((x) => !fora.includes(x) && re.test(semAcento(x)) && filtro(x))
      if (c) return c
    }
    return undefined
  }
  const padroesTel = [/whats|zap/, /celular|\bcel\b/, /telefone|fone|\btel\b/]
  const telefone = acha(padroesTel, temTelefone) ?? colunas.find((c) => amostra.filter((l) => pareceTelefone(l[c] ?? '')).length > Math.min(15, amostra.length / 2))
  const reserva = telefone ? acha(padroesTel, temTelefone, [telefone]) : undefined
  const nome = acha([/^nome|nome fantasia/, /empresa|loja|razao|fantasia/, /cliente/, /contato|socio/]) ?? colunas.find((c) => c !== telefone)
  return { nome: nome ?? '', telefone: telefone ?? '', reserva: reserva ?? '' }
}

/** Colunas que não vale mostrar para a vendedora: vazias e as de controle que o painel substitui. */
export function colunasOcultasPadrao(colunas: string[], linhas: Record<string, string>[]) {
  const controle = /^(n[ºo°]?\.?|#|item)$|link whats|status do contato|data do contato|proximo passo|situacao do contato/
  return colunas.filter((c) => controle.test(semAcento(c).trim()) || linhas.every((l) => !l[c]))
}

/** Acha a vendedora pelo nome escrito no arquivo ou na aba (ex.: "Lista_Jane.xlsx"). */
export function vendedoraPeloNome<T extends { nome: string }>(textos: string[], vendedoras: T[]) {
  const alvo = semAcento(textos.join(' ')).replace(/[^a-z0-9]+/g, ' ')
  const achadas = vendedoras.filter((v) => {
    const primeiro = semAcento(v.nome).split(/\s+/)[0]
    return primeiro.length >= 3 && new RegExp(`\\b${primeiro}\\b`).test(alvo)
  })
  return achadas.length === 1 ? achadas[0] : undefined
}

export async function exportarContatos(arquivo: string, contatos: Contato[], equipe: Membro[], checklist: string[], colunasExtras: string[]) {
  const { default: writeXlsxFile } = await import('write-excel-file/browser')
  const nomeDe = (v: string) => equipe.find((m) => m.vaga === v)?.nome ?? v
  const cab = ['Vendedora', 'Nome', 'Telefone', 'Situação', ...checklist, 'Retornar em', 'Observação', 'Atualizado em', ...colunasExtras]
  const linhas = contatos.map((c) => [
    nomeDe(c.vendedora),
    c.nome,
    c.telefone,
    STATUS[c.status].label,
    ...checklist.map((i) => (c.checklist[i] ? 'Sim' : '')),
    c.retorno ? dataBr(c.retorno) : '',
    c.obs,
    c.atualizadoEm ? dataHora(c.atualizadoEm) : '',
    ...colunasExtras.map((k) => c.dados[k] ?? ''),
  ])
  await writeXlsxFile([cab.map((v) => ({ value: v, fontWeight: 'bold' as const })), ...linhas], {
    columns: cab.map((c) => ({ width: c === 'Observação' ? 50 : Math.min(30, Math.max(12, c.length + 2)) })),
    stickyRowsCount: 1,
  }).toFile(arquivo)
}
