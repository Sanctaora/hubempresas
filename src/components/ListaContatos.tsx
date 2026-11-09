import { useState } from 'react'
import type { Contato, Membro } from '../lib/tipos'
import { useDados } from '../lib/dados'
import { ContatoCard } from './ContatoCard'
import { Button, Empty } from './ui'

const POR_PAGINA = 40

/** Lista de cartões com um aberto por vez e "mostrar mais". */
export function ListaContatos({ contatos, equipe, mostrarLista, vazio }: { contatos: Contato[]; equipe?: Membro[]; mostrarLista: boolean; vazio: string }) {
  const { dados } = useDados()
  const [aberto, setAberto] = useState<string>()
  const [limite, setLimite] = useState(POR_PAGINA)
  const nomeLista = (id: string) => dados.listas.find((l) => l.id === id)?.nome

  if (!contatos.length) return <Empty>{vazio}</Empty>
  return (
    <div className="space-y-2">
      {contatos.slice(0, limite).map((c) => (
        <ContatoCard
          key={c.id}
          contato={c}
          equipe={equipe}
          listaNome={mostrarLista ? nomeLista(c.listaId) : undefined}
          aberto={aberto === c.id}
          onAbrir={() => setAberto(aberto === c.id ? undefined : c.id)}
        />
      ))}
      {contatos.length > limite && (
        <Button variant="secondary" className="w-full" onClick={() => setLimite(limite + POR_PAGINA)}>
          Mostrar mais ({contatos.length - limite} restantes)
        </Button>
      )}
    </div>
  )
}
