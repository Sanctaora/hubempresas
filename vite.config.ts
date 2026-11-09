import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

/** Em desenvolvimento, atende /api/app com o mesmo código que roda na Vercel. */
function apiLocal(): Plugin {
  return {
    name: 'api-local',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/app')) return next()
        const mod = await server.ssrLoadModule('/api/app.ts')
        await mod.default(req, res)
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  // O servidor local lê DEV_USUARIO etc. do .env.local, como a Vercel faz com as variáveis do projeto
  Object.assign(process.env, loadEnv(mode, process.cwd(), ''))
  return { plugins: [react(), apiLocal()] }
})
