import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { randomBytes } from 'node:crypto'

export default defineConfig(({ command }) => {
  const nonce = randomBytes(16).toString('base64')

  return {
    main: {},
    preload: {
      build: {
        // The ESM main process supports electron-store; sandboxed preloads require CJS.
        externalizeDeps: false,
        lib: { formats: ['cjs'] },
        rolldownOptions: { output: { entryFileNames: 'index.cjs' } }
      }
    },
    renderer: {
      // Authorize Vite's inline React Refresh preamble only during development.
      html: command === 'serve' ? { cspNonce: nonce } : undefined,
      plugins: [
        react(),
        tailwindcss(),
        {
          name: 'development-csp',
          apply: 'serve',
          transformIndexHtml(html) {
            return html.replace("script-src 'self'", `script-src 'self' 'nonce-${nonce}'`)
          }
        }
      ]
    }
  }
})
