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

/** Adivinha qual coluna é o nome e qual é o telefone pelo cabeçalho. */
export function detectarColunas(colunas: string[], linhas: Record<string, string>[]) {
  const n = colunas.map(semAcento)
  const acha = (re: RegExp) => colunas[n.findIndex((c) => re.test(c))]
  const telefone =
    acha(/whats|zap|celular|telefone|fone|tel\b|tel\.|cel\b/) ??
    // Coluna em que a maioria dos valores parece telefone
    colunas.find((c) => linhas.slice(0, 30).filter((l) => /^\+?[\d\s().-]{8,}$/.test(l[c] ?? '')).length > Math.min(15, linhas.length / 2))
  const nome = acha(/^nome|cliente|razao|contato/) ?? colunas.find((c) => c !== telefone)
  return { nome: nome ?? '', telefone: telefone ?? '' }
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
