import { useState } from 'react'
import { ClipboardPaste, FileUp, X } from 'lucide-react'
import { api } from '../lib/api'
import { useDados } from '../lib/dados'
import { colunasOcultasPadrao, detectarColunas, FORMATOS, lerArquivo, lerTexto, vendedoraPeloNome, type Aba } from '../lib/planilha'
import type { Lista, Membro, Vaga } from '../lib/tipos'
import { cx, VENDEDORAS } from '../lib/utils'
import { Button, Field, Modal } from './ui'

const LOTE = 500
const digitos = (s: string) => s.replace(/\D/g, '')

/** Uma lista a subir: um arquivo (ou uma aba dele) e para quem vai. */
interface Item {
  id: string
  abas: Aba[]
  abaIdx: number
  nome: string
  colNome: string
  colTel: string
  colReserva: string
  ocultas: string[]
  vendedoras: Vaga[]
}

interface Filtros {
  semTelefone: boolean
  duplicados: boolean
}

function criarItem(abas: Aba[], abaIdx: number, nome: string, textos: string[], equipe: Membro[]): Item {
  const t = abas[abaIdx].tabela
  const d = detectarColunas(t.colunas, t.linhas)
  const vendedoras = equipe.filter((m) => m.papel === 'vendedora')
  const dona = vendedoraPeloNome([...textos, abas[abaIdx].nome], vendedoras)
  const ativas = vendedoras.filter((m) => m.ativo).map((m) => m.vaga)
  return {
    id: Math.random().toString(36).slice(2),
    abas,
    abaIdx,
    nome,
    colNome: d.nome,
    colTel: d.telefone,
    colReserva: d.reserva,
    ocultas: colunasOcultasPadrao(t.colunas, t.linhas),
    vendedoras: dona ? [dona.vaga] : ativas.length ? ativas : [...VENDEDORAS],
  }
}

/** Linhas que vão entrar (sem as descartadas), já com a vendedora de cada uma em rodízio. */
function plano(item: Item, f: Filtros) {
  const t = item.abas[item.abaIdx].tabela
  const vistos = new Set<string>()
  const linhas = t.linhas
    .map((l) => ({ l, tel: l[item.colTel] || l[item.colReserva] || '' }))
    .filter(({ tel }) => {
      const d = digitos(tel)
      if (f.semTelefone && d.length < 8) return false
      if (f.duplicados && d) {
        if (vistos.has(d)) return false
        vistos.add(d)
      }
      return true
    })
  const extras = t.colunas.filter((c) => c !== item.colNome && !item.ocultas.includes(c))
  return linhas.map(({ l, tel }, i) => ({
    vendedora: item.vendedoras[i % Math.max(1, item.vendedoras.length)],
    nome: l[item.colNome] ?? '',
    telefone: tel,
    dados: Object.fromEntries(extras.map((c) => [c, l[c] ?? ''])),
  }))
}

export function ImportarLista({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { dados, recarregar } = useDados()
  const equipe = dados.equipe ?? []
  const [itens, setItens] = useState<Item[]>([])
  const [filtros, setFiltros] = useState<Filtros>({ semTelefone: false, duplicados: true })
  const [colando, setColando] = useState(false)
  const [texto, setTexto] = useState('')
  const [erro, setErro] = useState<string>()
  const [progresso, setProgresso] = useState<string>()

  const nomeDe = (v: Vaga) => equipe.find((m) => m.vaga === v)?.nome ?? v
  const muda = (id: string, m: Partial<Item>) => setItens((xs) => xs.map((x) => (x.id === id ? { ...x, ...m } : x)))

  const limpar = () => {
    setItens([])
    setTexto('')
    setColando(false)
    setErro(undefined)
    onClose()
  }
  const fechar = () => progresso === undefined && limpar()

  const abrirArquivos = async (lista: FileList | null) => {
    if (!lista?.length) return
    setErro(undefined)
    const novos: Item[] = []
    const problemas: string[] = []
    for (const f of Array.from(lista)) {
      try {
        const abas = await lerArquivo(f)
        const base = f.name.replace(/\.[^.]+$/, '')
        if (!abas.length) {
          problemas.push(`${f.name}: sem linhas com dados`)
          continue
        }
        // Planilha com uma aba por vendedora: cada aba vira uma lista
        const porAba = abas.filter((a) => vendedoraPeloNome([a.nome], equipe.filter((m) => m.papel === 'vendedora')))
        if (abas.length > 1 && porAba.length > 1) porAba.forEach((a) => novos.push(criarItem(abas, abas.indexOf(a), `${base} - ${a.nome}`, [], equipe)))
        else novos.push(criarItem(abas, 0, base.replace(/[_]+/g, ' '), [f.name], equipe))
      } catch (e) {
        problemas.push(`${f.name}: ${(e as Error).message}`)
      }
    }
    setItens(novos)
    if (problemas.length) setErro(problemas.join('\n'))
  }

  const colar = () => {
    const t = lerTexto(texto)
    if (!t.linhas.length) return setErro('Não achei linhas com dados. A primeira linha precisa ser o cabeçalho (Nome, Telefone…).')
    setErro(undefined)
    setItens([criarItem([{ nome: 'Colado', tabela: t }], 0, `Lista ${new Date().toLocaleDateString('pt-BR')}`, [], equipe)])
  }

  const enviar = async () => {
    setErro(undefined)
    try {
      for (const [n, item] of itens.entries()) {
        const contatos = plano(item, filtros)
        const t = item.abas[item.abaIdx].tabela
        const colunas = t.colunas.filter((c) => c !== item.colNome && !item.ocultas.includes(c))
        const { lista } = await api<{ lista: Lista }>('criarLista', { nome: item.nome, colunas })
        for (let i = 0; i < contatos.length; i += LOTE) {
          setProgresso(itens.length > 1 ? `Lista ${n + 1}/${itens.length}…` : `${i}/${contatos.length}…`)
          await api('adicionarContatos', { listaId: lista.id, contatos: contatos.slice(i, i + LOTE) })
        }
      }
      await recarregar()
      setProgresso(undefined)
      limpar()
    } catch (e) {
      setErro(`${(e as Error).message} Alguma lista pode ter ficado incompleta: confira em Listas, exclua e suba de novo.`)
      setProgresso(undefined)
      await recarregar()
    }
  }

  const totais = itens.map((it) => plano(it, filtros).length)
  const total = totais.reduce((a, b) => a + b, 0)
  const pronto = itens.length > 0 && itens.every((it, i) => it.nome.trim() && it.vendedoras.length && totais[i] > 0)
  const enviando = progresso !== undefined

  return (
    <Modal
      open={open}
      onClose={fechar}
      title={itens.length > 1 ? `Subir ${itens.length} listas` : 'Subir lista de contatos'}
      footer={
        itens.length > 0 && (
          <>
            <Button variant="ghost" onClick={() => setItens([])} disabled={enviando}>Trocar arquivo</Button>
            <Button onClick={() => void enviar()} disabled={enviando || !pronto}>
              {enviando ? `Enviando ${progresso}` : itens.length > 1 ? `Enviar ${itens.length} listas (${total} contatos)` : `Distribuir ${total} contatos`}
            </Button>
          </>
        )
      }
    >
      {!itens.length ? (
        <div className="space-y-3">
          {!colando ? (
            <>
              <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-slate-300 p-8 text-center hover:border-azul-400 hover:bg-azul-50/40">
                <FileUp size={28} className="text-azul-500" />
                <span className="font-semibold text-brand-600">Escolher planilha(s)</span>
                <span className="text-xs text-slate-500">
                  Excel (.xlsx), CSV ou TXT. Pode escolher vários arquivos de uma vez: se o nome do arquivo tiver o nome da vendedora (ex.: <b>Lista_Jane.xlsx</b>), a lista vai direto para ela.
                </span>
                <input type="file" multiple accept={FORMATOS} className="hidden" onChange={(e) => void abrirArquivos(e.target.files)} />
              </label>
              <button onClick={() => setColando(true)} className="flex w-full items-center justify-center gap-1.5 text-sm text-azul-600 hover:underline">
                <ClipboardPaste size={15} /> Ou colar direto do Excel / Google Planilhas
              </button>
            </>
          ) : (
            <>
              <Field label="Cole aqui as linhas copiadas (com a linha de títulos)">
                <textarea className="input min-h-[180px] font-mono text-xs" value={texto} onChange={(e) => setTexto(e.target.value)} placeholder={'Nome\tTelefone\tCidade\nMaria Souza\t(11) 98888-7777\tSão Paulo'} />
              </Field>
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setColando(false)}>Voltar</Button>
                <Button disabled={!texto.trim()} onClick={colar}>Continuar</Button>
              </div>
            </>
          )}
          {erro && <p className="whitespace-pre-line text-sm text-red-600">{erro}</p>}
        </div>
      ) : (
        <div className="space-y-4">
          {itens.length === 1 ? (
            <Detalhe item={itens[0]} muda={(m) => muda(itens[0].id, m)} nomeDe={nomeDe} equipe={equipe} total={totais[0]} />
          ) : (
            <div className="space-y-2">
              {itens.map((it, i) => (
                <div key={it.id} className="rounded-xl border border-slate-200 p-3">
                  <div className="flex items-start gap-2">
                    <input className="input flex-1" value={it.nome} onChange={(e) => muda(it.id, { nome: e.target.value })} aria-label="Nome da lista" />
                    <button onClick={() => setItens(itens.filter((x) => x.id !== it.id))} className="rounded p-2 text-slate-400 hover:bg-slate-100" aria-label="Tirar esta lista"><X size={16} /></button>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                    <span className="text-slate-500">{totais[i]} contatos → </span>
                    <select
                      className={cx('input w-auto', it.vendedoras.length !== 1 && 'border-amber-300')}
                      value={it.vendedoras.length === 1 ? it.vendedoras[0] : 'todas'}
                      onChange={(e) => muda(it.id, { vendedoras: e.target.value === 'todas' ? [...VENDEDORAS] : [e.target.value as Vaga] })}
                    >
                      {VENDEDORAS.map((v) => <option key={v} value={v}>{nomeDe(v)}</option>)}
                      <option value="todas">Dividir entre as 5</option>
                    </select>
                  </div>
                  <p className="mt-1.5 text-[11px] text-slate-500">
                    Nome: <b>{it.colNome || '—'}</b> · Telefone: <b>{it.colTel || '—'}</b>{it.colReserva && <> (se vazio: <b>{it.colReserva}</b>)</>}
                  </p>
                </div>
              ))}
              <p className="text-xs text-slate-500">Para ajustar colunas de uma lista específica, suba o arquivo sozinho.</p>
            </div>
          )}

          <div className="space-y-1.5 text-sm">
            <label className="flex items-center gap-2"><input type="checkbox" checked={filtros.duplicados} onChange={(e) => setFiltros({ ...filtros, duplicados: e.target.checked })} /> Ignorar telefones repetidos</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={filtros.semTelefone} onChange={(e) => setFiltros({ ...filtros, semTelefone: e.target.checked })} /> Ignorar linhas sem nenhum telefone</label>
          </div>
          {erro && <p className="whitespace-pre-line text-sm text-red-600">{erro}</p>}
        </div>
      )}
    </Modal>
  )
}

function Detalhe({ item, muda, nomeDe, equipe, total }: { item: Item; muda: (m: Partial<Item>) => void; nomeDe: (v: Vaga) => string; equipe: Membro[]; total: number }) {
  const t = item.abas[item.abaIdx].tabela
  const colunaSelect = (valor: string, onChange: (v: string) => void) => (
    <select className="input" value={valor} onChange={(e) => onChange(e.target.value)}>
      <option value="">(nenhuma)</option>
      {t.colunas.map((c) => <option key={c}>{c}</option>)}
    </select>
  )
  const trocarAba = (i: number) => {
    const novo = criarItem(item.abas, i, item.nome, [], equipe)
    muda({ ...novo, id: item.id, nome: item.nome })
  }
  const visiveis = t.colunas.filter((c) => c !== item.colNome && c !== item.colTel && c !== item.colReserva)

  return (
    <>
      {item.abas.length > 1 && (
        <Field label="Aba da planilha">
          <select className="input" value={item.abaIdx} onChange={(e) => trocarAba(Number(e.target.value))}>
            {item.abas.map((a, i) => <option key={i} value={i}>{a.nome} ({a.tabela.linhas.length} linhas)</option>)}
          </select>
        </Field>
      )}
      <Field label="Nome da lista">
        <input className="input" value={item.nome} onChange={(e) => muda({ nome: e.target.value })} placeholder="Ex.: Lojas Goiás - novembro" />
      </Field>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Coluna do nome">{colunaSelect(item.colNome, (v) => muda({ colNome: v }))}</Field>
        <Field label="Telefone / WhatsApp">{colunaSelect(item.colTel, (v) => muda({ colTel: v }))}</Field>
        <Field label="Se vazio, usar">{colunaSelect(item.colReserva, (v) => muda({ colReserva: v }))}</Field>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full text-xs">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>{t.colunas.map((c) => <th key={c} className={cx('whitespace-nowrap px-2 py-1.5 font-semibold', [item.colNome, item.colTel, item.colReserva].includes(c) && 'text-azul-700')}>{c}</th>)}</tr>
          </thead>
          <tbody>
            {t.linhas.slice(0, 4).map((l, i) => (
              <tr key={i} className="border-t border-slate-100">{t.colunas.map((c) => <td key={c} className="max-w-[160px] truncate whitespace-nowrap px-2 py-1.5">{l[c]}</td>)}</tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="-mt-2 text-xs text-slate-500">{t.linhas.length} linhas na planilha · {total} vão entrar</p>

      <div>
        <p className="label">Informações que a vendedora vê no contato</p>
        <div className="flex flex-wrap gap-1.5">
          {visiveis.map((c) => {
            const oculta = item.ocultas.includes(c)
            return (
              <button
                key={c}
                onClick={() => muda({ ocultas: oculta ? item.ocultas.filter((x) => x !== c) : [...item.ocultas, c] })}
                className={cx('rounded-full border px-2.5 py-1 text-xs transition', oculta ? 'border-slate-200 text-slate-400 line-through' : 'border-azul-200 bg-azul-50 text-azul-700')}
              >
                {c}
              </button>
            )
          })}
        </div>
      </div>

      <div>
        <p className="label">Para quem vai</p>
        <div className="grid gap-1.5 sm:grid-cols-2">
          {VENDEDORAS.map((v) => {
            const m = equipe.find((x) => x.vaga === v)
            const marcada = item.vendedoras.includes(v)
            return (
              <label key={v} className={cx('flex items-center gap-2 rounded-lg border px-2.5 py-2 text-sm', marcada ? 'border-azul-200 bg-azul-50' : 'border-slate-200')}>
                <input type="checkbox" checked={marcada} onChange={() => muda({ vendedoras: marcada ? item.vendedoras.filter((x) => x !== v) : VENDEDORAS.filter((x) => x === v || item.vendedoras.includes(x)) })} />
                <span className="flex-1">
                  {nomeDe(v)}
                  {!m?.ativo && <span className="ml-1 text-[11px] text-amber-700">(ainda sem acesso)</span>}
                </span>
              </label>
            )
          })}
        </div>
        <p className="mt-1 text-xs text-slate-500">Com mais de uma marcada, os contatos são divididos igualmente. Depois dá para trocar a vendedora de qualquer contato.</p>
      </div>
    </>
  )
}
