#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'))
}

function argument(name) {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : undefined
}

function fail(message) {
  console.error(`[dsh-start] error: ${message}`)
  process.exit(1)
}

const profileRoot = argument('--profile-root')
const pluginRoot = argument('--plugin-root')
const harnessRoot = argument('--harness-root')

if (!profileRoot || !pluginRoot || !harnessRoot) {
  fail('usage: verify-local-runtime.mjs --profile-root DIR --plugin-root DIR --harness-root DIR')
}

const resolvedProfileRoot = path.resolve(profileRoot)
const resolvedPluginRoot = path.resolve(pluginRoot)
const resolvedHarnessRoot = path.resolve(harnessRoot)
const profileManifestPath = path.join(resolvedProfileRoot, 'package.json')
const harnessManifestPath = path.join(resolvedHarnessRoot, 'package.json')

for (const [label, file] of [
  ['profile manifest', profileManifestPath],
  ['Harness manifest', harnessManifestPath],
  ['resource-center manifest', path.join(resolvedPluginRoot, 'resource-center-plugin', 'package.json')],
  ['security manifest', path.join(resolvedPluginRoot, 'dsh-security', 'package.json')],
]) {
  if (!fs.existsSync(file)) fail(`${label} not found: ${file}`)
}

const profile = readJson(profileManifestPath)
const harness = readJson(harnessManifestPath)
const bundles = profile.dsh?.profile?.bundles || []
if (!bundles.includes('dsh-resource-center') || !bundles.includes('dsh-security')) {
  fail(`profile ${resolvedProfileRoot} must include dsh-resource-center and dsh-security bundles`)
}
if (harness.name !== '@deepseek-ai/dsh-root') {
  fail(`Harness root is not a DSH source checkout: ${harness.name || 'unknown package'}`)
}

const expectedLinks = {
  'dsh-resource-center': path.join(resolvedPluginRoot, 'resource-center-plugin'),
  'dsh-security': path.join(resolvedPluginRoot, 'dsh-security'),
}
for (const [name, expectedPath] of Object.entries(expectedLinks)) {
  const expectedSpecifier = `link:${expectedPath}`
  if (profile.dependencies?.[name] !== expectedSpecifier) {
    fail(`${name} must be linked from the current checkout (${expectedSpecifier}), got ${profile.dependencies?.[name] || 'missing'}`)
  }
  const installedPath = path.join(resolvedProfileRoot, 'node_modules', name)
  if (!fs.existsSync(installedPath)) fail(`profile dependency is missing: ${installedPath}`)
  const actualPath = fs.realpathSync(installedPath)
  if (actualPath !== fs.realpathSync(expectedPath)) {
    fail(`${name} resolves to ${actualPath}, expected ${expectedPath}`)
  }
}

console.log(`[dsh-start] local runtime verified: Harness ${harness.version || 'unknown'} + profile ${path.basename(resolvedProfileRoot)} + linked plugins`)
