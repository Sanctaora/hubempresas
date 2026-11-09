import { useRef } from 'react'
import type { Contato } from './tipos'

/**
 * Ordena os contatos uma vez por `chave` (aba, filtros) e mantém essa ordem enquanto a pessoa trabalha:
 * marcar checklist ou voltar do WhatsApp (que recarrega os dados) não faz o cartão pular de lugar.
 * Contatos que chegarem depois entram no fim.
 */
export function useOrdemFixa(contatos: Contato[], chave: string, comparar: (a: Contato, b: Contato) => number) {
  const ref = useRef<{ chave: string; pos: Map<string, number> }>()
  if (!ref.current || ref.current.chave !== chave) {
    ref.current = { chave, pos: new Map([...contatos].sort(comparar).map((c, i) => [c.id, i])) }
  }
  const pos = ref.current.pos
  for (const c of contatos) if (!pos.has(c.id)) pos.set(c.id, pos.size)
  return [...contatos].sort((a, b) => pos.get(a.id)! - pos.get(b.id)!)
}
