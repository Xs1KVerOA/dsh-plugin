import { fileURLToPath } from 'node:url'

export const name = 'dsh-security-preset-root'
export const inject = ['agentPresets']

export function apply(ctx) {
  const root = fileURLToPath(new URL('./presets/', import.meta.url))
  const presets = ctx.get('agentPresets')
  if (!presets.resolvedRoots.some(entry => entry.path === root)) presets.resolvedRoots.unshift({ path: root, trust: 'system' })
  // `security` was the original name of this mode. Keep persisted sessions
  // resumable after the rename without exposing a duplicate picker entry.
  // Newer Harness builds expose a first-class alias seam. The fallback keeps
  // this plugin compatible with older locally installed Harness binaries
  // whose AgentPresets service predates that seam.
  if (typeof presets.registerAlias === 'function') {
    presets.registerAlias('security', 'pentest')
  } else {
    const resolve = presets.resolve.bind(presets)
    presets.resolve = (id) => resolve(id === 'security' ? 'pentest' : id)
  }
}
