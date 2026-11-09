import { useState } from 'react'
import { Search } from 'lucide-react'
import { useDados } from '../lib/dados'
import type { Contato } from '../lib/tipos'
import { useOrdemFixa } from '../lib/ordem'
import { hoje, semAcento, STATUS } from '../lib/utils'
import { ListaContatos } from '../components/ListaContatos'
import { Tabs } from '../components/ui'

type Aba = 'fazer' | 'retornos' | 'finalizados'

const prioridade = (c: Contato, h: string) => (c.retorno && c.retorno <= h ? 0 : c.status === 'andamento' ? 1 : c.status === 'retornar' ? 2 : 3)

export function filtrarBusca(contatos: Contato[], busca: string) {
  const q = semAcento(busca.trim())
  if (!q) return contatos
  return contatos.filter((c) => semAcento(`${c.nome} ${c.telefone} ${c.obs} ${Object.values(c.dados).join(' ')}`).includes(q))
}

export default function MeusContatos() {
  const { dados } = useDados()
  const [aba, setAba] = useState<Aba>('fazer')
  const [lista, setLista] = useState('todas')
  const [busca, setBusca] = useState('')
  const h = hoje()

  const meus = dados.contatos.filter((c) => lista === 'todas' || c.listaId === lista)
  const abertos = meus.filter((c) => !STATUS[c.status].final)
  const vendas = meus.filter((c) => c.status === 'vendeu').length

  // A ordem só muda ao trocar de aba/lista, para o cartão não pular de lugar enquanto ela mexe
  const chave = `${aba}|${lista}`
  const fazer = useOrdemFixa(abertos, chave, (a, b) => prioridade(a, h) - prioridade(b, h))
  const retornos = useOrdemFixa(abertos.filter((c) => c.retorno), chave, (a, b) => a.retorno!.localeCompare(b.retorno!))
  const finalizados = useOrdemFixa(meus.filter((c) => STATUS[c.status].final), chave, (a, b) => (b.atualizadoEm ?? '').localeCompare(a.atualizadoEm ?? ''))
  const vencidos = retornos.filter((c) => c.retorno! <= h).length

  const visiveis = filtrarBusca(aba === 'fazer' ? fazer : aba === 'retornos' ? retornos : finalizados, busca)

  return (
    <>
      <h1 className="text-2xl font-bold tracking-tight text-brand-600">Meus contatos</h1>
      <div className="mt-3 grid grid-cols-3 gap-2">
        <Resumo valor={abertos.length} label="a fazer" />
        <Resumo valor={vencidos} label="retornar hoje" destaque={vencidos > 0} />
        <Resumo valor={vendas} label={vendas === 1 ? 'venda' : 'vendas'} verde />
      </div>

      <div className="mt-4">
        <Tabs<Aba>
          tabs={[
            { id: 'fazer', label: `A fazer (${abertos.length})` },
            { id: 'retornos', label: `Retornos (${retornos.length})` },
            { id: 'finalizados', label: `Finalizados (${finalizados.length})` },
          ]}
          value={aba}
          onChange={setAba}
        />
      </div>

      <div className="my-3 flex flex-wrap gap-2">
        <div className="relative min-w-[180px] flex-1">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input className="input pl-9" placeholder="Buscar nome, telefone…" value={busca} onChange={(e) => setBusca(e.target.value)} />
        </div>
        {dados.listas.length > 1 && (
          <select className="input w-auto" value={lista} onChange={(e) => setLista(e.target.value)}>
            <option value="todas">Todas as listas</option>
            {dados.listas.map((l) => <option key={l.id} value={l.id}>{l.nome}</option>)}
          </select>
        )}
      </div>

      <ListaContatos
        key={aba + lista}
        contatos={visiveis}
        mostrarLista={dados.listas.length > 1 && lista === 'todas'}
        vazio={
          busca ? 'Nada encontrado nessa busca.' : aba === 'fazer' ? (dados.contatos.length ? 'Tudo feito por aqui! 🎉' : 'Você ainda não recebeu contatos. Assim que a gerente enviar uma lista, eles aparecem aqui.') : aba === 'retornos' ? 'Nenhum retorno agendado.' : 'Nenhum contato finalizado ainda.'
        }
      />
    </>
  )
}

function Resumo({ valor, label, destaque, verde }: { valor: number; label: string; destaque?: boolean; verde?: boolean }) {
  return (
    <div className={`rounded-xl border p-3 text-center ${destaque ? 'border-red-200 bg-red-50' : 'border-slate-200 bg-white'}`}>
      <p className={`text-2xl font-bold tabular-nums ${destaque ? 'text-red-600' : verde ? 'text-verde-700' : 'text-brand-600'}`}>{valor}</p>
      <p className="text-[11px] text-slate-500">{label}</p>
    </div>
  )
}
