export class ErroApi extends Error {
  constructor(public status: number, msg: string) {
    super(msg)
  }
}

/** Chama uma ação do servidor (/api/app?acao=...). */
export async function api<T = any>(acao: string, corpo: object = {}): Promise<T> {
  let res: Response
  try {
    res = await fetch(`/api/app?acao=${acao}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(corpo),
    })
  } catch {
    throw new ErroApi(0, 'Sem conexão com a internet. Tente de novo.')
  }
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new ErroApi(res.status, body.erro ?? `Erro ${res.status}`)
  return body as T
}
