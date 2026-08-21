import { readFile, readdir } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const packageDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const coreRoot = resolve(process.env.DSH_CORE_ROOT || join(packageDir, '../../deepseek-harness'))

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'))
}

async function collectCorePackages(root) {
  const result = new Map()
  async function visit(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name === '.git') continue
      const path = join(directory, entry.name)
      if (entry.isDirectory()) await visit(path)
      else if (entry.name === 'package.json') {
        try {
          const pkg = await readJson(path)
          if (pkg.name?.startsWith('@deepseek-ai/dsh-')) result.set(pkg.name, pkg.version)
        } catch { /* Ignore generated or incomplete package manifests. */ }
      }
    }
  }
  await visit(join(root, 'packages'))
  return result
}

const plugin = await readJson(join(packageDir, 'package.json'))
const core = await readJson(join(coreRoot, 'package.json'))
const corePackages = await collectCorePackages(coreRoot)
const declared = { ...plugin.dependencies, ...plugin.peerDependencies, ...plugin.optionalDependencies }
const mismatches = []
for (const [name, declaredRange] of Object.entries(declared)) {
  const expected = corePackages.get(name)
  if (expected && declaredRange !== expected) mismatches.push(`${name}: declared ${declaredRange}, core ${expected}`)
}

if (mismatches.length) {
  console.error(`DSH release mismatch: core ${core.version}`)
  for (const item of mismatches) console.error(`- ${item}`)
  process.exitCode = 1
} else {
  console.log(`DSH release compatible: ${plugin.name} -> core ${core.version}`)
}
