import { useCallback, useEffect, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { api } from './lib/api'
import { DadosProvider } from './lib/dados'
import type { Membro } from './lib/tipos'
import { Layout } from './components/Layout'
import { Login, PrimeiroAcesso } from './pages/Login'
import Listas from './pages/Listas'
import Acompanhamento from './pages/Acompanhamento'
import Equipe from './pages/Equipe'
import MeusContatos from './pages/MeusContatos'

export default function App() {
  const [eu, setEu] = useState<Membro | null>()

  useEffect(() => {
    api<{ eu: Membro }>('eu')
      .then((r) => setEu(r.eu))
      .catch(() => setEu(null))
  }, [])

  const sair = useCallback(() => {
    void api('sair').catch(() => undefined)
    setEu(null)
  }, [])

  if (eu === undefined) return <div className="flex min-h-screen items-center justify-center text-sm text-slate-500">Carregando…</div>
  if (!eu) return <Login onEntrar={setEu} />
  if (eu.trocarSenha) return <PrimeiroAcesso eu={eu} onPronto={setEu} onSair={sair} />

  const admin = eu.papel !== 'vendedora'
  return (
    <DadosProvider onSair={sair}>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout onSair={sair} />}>
            {admin ? (
              <>
                <Route index element={<Listas />} />
                <Route path="acompanhamento" element={<Acompanhamento />} />
                <Route path="equipe" element={<Equipe />} />
              </>
            ) : (
              <Route index element={<MeusContatos />} />
            )}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </DadosProvider>
  )
}
