import { spawn } from 'node:child_process'

const commands = [
  { name: 'workflow', command: 'npm', args: ['run', 'qa:workflow-local'] },
  { name: 'edge', command: 'npm', args: ['run', 'qa:edge-local'] },
]

async function runStep(step) {
  return new Promise((resolve, reject) => {
    const child = spawn(step.command, step.args, {
      stdio: 'inherit',
      shell: true,
      env: process.env,
    })

    child.on('exit', (code) => {
      if (code === 0) {
        resolve(undefined)
        return
      }
      reject(new Error(`${step.name} failed with code ${code ?? 'unknown'}`))
    })

    child.on('error', reject)
  })
}

try {
  for (const step of commands) {
    console.log(`\n=== Running local QA: ${step.name} ===`)
    await runStep(step)
  }
  console.log('\nAll local QA checks passed.')
} catch (error) {
  console.error(error)
  process.exit(1)
}
