import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import fs from 'fs'

function serveDataPlugin() {
  return {
    name: 'serve-data',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url || !req.url.startsWith('/data/')) return next()

        const filePath = path.join(__dirname, req.url.split('?')[0])
        if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
          return next()
        }

        const ext = path.extname(filePath)
        const mimeMap: Record<string, string> = {
          '.json': 'application/json',
          '.txt': 'text/plain',
          '.xml': 'application/xml',
        }
        res.setHeader('Content-Type', mimeMap[ext] || 'application/octet-stream')
        res.setHeader('Cache-Control', 'no-cache')
        fs.createReadStream(filePath).pipe(res)
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), serveDataPlugin()],
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    fs: {
      allow: [path.resolve(__dirname), path.resolve(__dirname, 'data')],
    },
  },
})
