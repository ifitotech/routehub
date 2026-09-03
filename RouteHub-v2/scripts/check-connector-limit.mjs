#!/usr/bin/env node
import {readdirSync, statSync} from 'node:fs'
import {join} from 'node:path'

const LIMIT = 16000
const roots = ['app', 'lib', 'components']
const skip = new Set(['node_modules', '.next', '.git'])
const tooBig = []

function walk(dir) {
  let entries = []
  try { entries = readdirSync(dir, {withFileTypes: true}) } catch { return }
  for (const entry of entries) {
    if (skip.has(entry.name)) continue
    const path = join(dir, entry.name)
    if (entry.isDirectory()) walk(path)
    else if (/\.(tsx|ts|css|mjs|js|md)$/.test(entry.name)) {
      const size = statSync(path).size
      if (size > LIMIT) tooBig.push({path, size})
    }
  }
}

for (const root of roots) walk(root)
if (!tooBig.length) {
  console.log(`ok: no agent-push files over ${LIMIT} bytes`)
  process.exit(0)
}
console.error(`files over ${LIMIT} bytes (split before connector push):`)
for (const item of tooBig.sort((a, b) => b.size - a.size)) {
  console.error(`  ${item.size}\t${item.path}`)
}
process.exit(1)
