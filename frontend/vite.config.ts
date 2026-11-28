import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const puerto = Number(process.env.FRONTEND_PORT ?? '5173')
if (!Number.isInteger(puerto) || puerto < 1 || puerto > 65535) throw new Error('FRONTEND_PORT no es válido.')
export default defineConfig({
  server: { port: puerto },
  plugins: [react()],
})
