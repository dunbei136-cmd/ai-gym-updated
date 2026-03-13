import { spawn } from 'node:child_process'

const children = []
const apiPort = process.env.PORT || '8788'
const clientPort = process.env.CLIENT_PORT || '5175'
const clientHost = process.env.CLIENT_HOST || '127.0.0.1'
const apiBaseUrl = process.env.VITE_API_BASE_URL || `http://${clientHost}:${apiPort}`

function start(name, command, args, extraEnv = {}) {
  const child = spawn(command, args, {
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, ...extraEnv },
  })

  child.on('exit', (code) => {
    if (code && code !== 0) {
      console.error(`${name} exited with code ${code}`)
    }
  })

  children.push(child)
}

function shutdown() {
  for (const child of children) {
    if (!child.killed) {
      child.kill()
    }
  }
  process.exit(0)
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

console.log(`Starting API on http://127.0.0.1:${apiPort}`)
console.log(`Starting client on http://${clientHost}:${clientPort}`)
console.log(`Client API target: ${apiBaseUrl}`)

start('api', 'npm', ['run', 'dev:server'], { PORT: apiPort })
start('client', 'npm', ['run', 'dev', '--', '--host', clientHost, '--port', clientPort], {
  VITE_API_MODE: 'http',
  VITE_API_BASE_URL: apiBaseUrl,
})
