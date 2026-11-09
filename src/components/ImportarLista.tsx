import { useMemo, useState } from 'react'
import { ClipboardPaste, FileUp } from 'lucide-react'
import { api } from '../lib/api'
import { useDados } from '../lib/dados'
import { detectarColunas, FORMATOS, lerArquivo, lerTexto, type Aba } from '../lib/planilha'
import type { Lista, Vaga } from '../lib/tipos'
import { cx, VENDEDORAS } from '../lib/utils'
import { Button, Field, Modal } from './ui'

const LOTE = 500
const digitos = (s: string) => s.replace(/\D/g, '')

export function ImportarLista({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { dados, recarregar } = useDados()
  const equipe = dados.equipe ?? []
  const [abas, setAbas] = useState<Aba[]>()
  const [abaIdx, setAbaIdx] = useState(0)
  const [nome, setNome] = useState('')
  const [colNome, setColNome] = useState('')
  const [colTel, setColTel] = useState('')
  const [semTelefone, setSemTelefone] = useState(true)
  const [duplicados, setDuplicados] = useState(true)
  const [escolhidas, setEscolhidas] = useState<Vaga[]>(() => VENDEDORAS.filter((v) => equipe.find((m) => m.vaga === v)?.ativo))
  const [colando, setColando] = useState(false)
  const [texto, setTexto] = useState('')
  const [erro, setErro] = useState<string>()
  const [progresso, setProgresso] = useState<number>()

  const tabela = abas?.[abaIdx]?.tabela
  const nomeDe = (v: Vaga) => equipe.find((m) => m.vaga === v)?.nome ?? v

  const limpar = () => {
    setAbas(undefined)
    setTexto('')
    setColando(false)
    setErro(undefined)
    onClose()
  }
  const fechar = () => progresso === undefined && limpar()

  const carregar = (novas: Aba[], nomeSugerido: string) => {
    if (!novas.length || !novas[0].tabela.linhas.length) return setErro('Não achei linhas com dados. A primeira linha precisa ser o cabeçalho (Nome, Telefone…).')
    setErro(undefined)
    setAbas(novas)
    escolherAba(novas, 0)
    setNome(nomeSugerido)
  }

  const escolherAba = (lista: Aba[], i: number) => {
    setAbaIdx(i)
    const t = lista[i].tabela
    const d = detectarColunas(t.colunas, t.linhas)
    setColNome(d.nome)
    setColTel(d.telefone)
  }

  const abrirArquivo = async (f: File | undefined) => {
    if (!f) return
    try {
      carregar(await lerArquivo(f), f.name.replace(/\.[^.]+$/, ''))
    } catch (e) {
      setErro((e as Error).message)
    }
  }

  // Linhas que vão entrar, já sem as vazias/duplicadas, distribuídas em rodízio
  const plano = useMemo(() => {
    if (!tabela) return []
    const vistos = new Set<string>()
    const linhas = tabela.linhas.filter((l) => {
      const tel = digitos(l[colTel] ?? '')
      if (semTelefone && colTel && tel.length < 8) return false
      if (duplicados && tel) {
        if (vistos.has(tel)) return false
        vistos.add(tel)
      }
      return true
    })
    return linhas.map((l, i) => ({ linha: l, vendedora: escolhidas[i % Math.max(1, escolhidas.length)] }))
  }, [tabela, colTel, semTelefone, duplicados, escolhidas])

  const enviar = async () => {
    if (!tabela || !escolhidas.length) return
    setErro(undefined)
    setProgresso(0)
    try {
      const extras = tabela.colunas.filter((c) => c !== colNome && c !== colTel)
      const { lista } = await api<{ lista: Lista }>('criarLista', { nome, colunas: extras })
      for (let i = 0; i < plano.length; i += LOTE) {
        const contatos = plano.slice(i, i + LOTE).map(({ linha, vendedora }) => ({
          vendedora,
          nome: linha[colNome] ?? '',
          telefone: linha[colTel] ?? '',
          dados: Object.fromEntries(extras.map((c) => [c, linha[c] ?? ''])),
        }))
        await api('adicionarContatos', { listaId: lista.id, contatos })
        setProgresso(Math.min(plano.length, i + LOTE))
      }
      await recarregar()
      setProgresso(undefined)
      limpar()
    } catch (e) {
      setErro(`${(e as Error).message} A lista pode ter ficado incompleta: exclua e suba de novo.`)
      setProgresso(undefined)
      await recarregar()
    }
  }

  const contagem = (v: Vaga) => plano.filter((p) => p.vendedora === v).length
  const enviando = progresso !== undefined

  return (
    <Modal
      open={open}
      onClose={fechar}
      title="Subir lista de contatos"
      footer={
        tabela && (
          <>
            <Button variant="ghost" onClick={() => setAbas(undefined)} disabled={enviando}>Trocar arquivo</Button>
            <Button onClick={enviar} disabled={enviando || !nome.trim() || !escolhidas.length || !plano.length}>
              {enviando ? `Enviando ${progresso}/${plano.length}…` : `Distribuir ${plano.length} contatos`}
            </Button>
          </>
        )
      }
    >
      {!tabela ? (
        <div className="space-y-3">
          {!colando ? (
            <>
              <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-slate-300 p-8 text-center hover:border-azul-400 hover:bg-azul-50/40">
                <FileUp size={28} className="text-azul-500" />
                <span className="font-semibold text-brand-600">Escolher planilha</span>
                <span className="text-xs text-slate-500">Excel (.xlsx), CSV ou TXT. A primeira linha deve ter os títulos das colunas.</span>
                <input type="file" accept={FORMATOS} className="hidden" onChange={(e) => void abrirArquivo(e.target.files?.[0])} />
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
                <Button disabled={!texto.trim()} onClick={() => carregar([{ nome: 'Colado', tabela: lerTexto(texto) }], `Lista ${new Date().toLocaleDateString('pt-BR')}`)}>Continuar</Button>
              </div>
            </>
          )}
          {erro && <p className="text-sm text-red-600">{erro}</p>}
        </div>
      ) : (
        <div className="space-y-4">
          {abas!.length > 1 && (
            <Field label="Aba da planilha">
              <select className="input" value={abaIdx} onChange={(e) => escolherAba(abas!, Number(e.target.value))}>
                {abas!.map((a, i) => <option key={i} value={i}>{a.nome} ({a.tabela.linhas.length} linhas)</option>)}
              </select>
            </Field>
          )}
          <Field label="Nome da lista">
            <input className="input" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Clientes Black Friday" />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Coluna do nome">
              <select className="input" value={colNome} onChange={(e) => setColNome(e.target.value)}>
                <option value="">(nenhuma)</option>
                {tabela.colunas.map((c) => <option key={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Coluna do telefone / WhatsApp">
              <select className="input" value={colTel} onChange={(e) => setColTel(e.target.value)}>
                <option value="">(nenhuma)</option>
                {tabela.colunas.map((c) => <option key={c}>{c}</option>)}
              </select>
            </Field>
          </div>

          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 text-left text-slate-500">
                <tr>{tabela.colunas.map((c) => <th key={c} className={cx('whitespace-nowrap px-2 py-1.5 font-semibold', (c === colNome || c === colTel) && 'text-azul-700')}>{c}</th>)}</tr>
              </thead>
              <tbody>
                {tabela.linhas.slice(0, 4).map((l, i) => (
                  <tr key={i} className="border-t border-slate-100">{tabela.colunas.map((c) => <td key={c} className="max-w-[160px] truncate whitespace-nowrap px-2 py-1.5">{l[c]}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="-mt-2 text-xs text-slate-500">{tabela.linhas.length} linhas na planilha · as outras colunas aparecem para a vendedora como informação extra.</p>

          <div className="space-y-1.5 text-sm">
            <label className="flex items-center gap-2"><input type="checkbox" checked={semTelefone} onChange={(e) => setSemTelefone(e.target.checked)} /> Ignorar linhas sem telefone</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={duplicados} onChange={(e) => setDuplicados(e.target.checked)} /> Ignorar telefones repetidos</label>
          </div>

          <div>
            <p className="label">Dividir igualmente entre</p>
            <div className="grid gap-1.5 sm:grid-cols-2">
              {VENDEDORAS.map((v) => {
                const m = equipe.find((x) => x.vaga === v)
                const marcada = escolhidas.includes(v)
                return (
                  <label key={v} className={cx('flex items-center gap-2 rounded-lg border px-2.5 py-2 text-sm', marcada ? 'border-azul-200 bg-azul-50' : 'border-slate-200')}>
                    <input type="checkbox" checked={marcada} onChange={() => setEscolhidas(marcada ? escolhidas.filter((x) => x !== v) : VENDEDORAS.filter((x) => x === v || escolhidas.includes(x)))} />
                    <span className="flex-1">
                      {nomeDe(v)}
                      {!m?.ativo && <span className="ml-1 text-[11px] text-amber-700">(ainda sem acesso)</span>}
                    </span>
                    {marcada && <span className="text-xs tabular-nums text-slate-500">{contagem(v)}</span>}
                  </label>
                )
              })}
            </div>
            <p className="mt-1 text-xs text-slate-500">Marque só uma para mandar a lista inteira para ela. Depois dá para trocar a vendedora de qualquer contato.</p>
          </div>
          {erro && <p className="text-sm text-red-600">{erro}</p>}
        </div>
      )}
    </Modal>
  )
}
