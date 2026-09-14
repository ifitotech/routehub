import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync, readdirSync, statSync} from 'node:fs'
import {join} from 'node:path'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
const root = new URL('..', import.meta.url).pathname.replace(/^\/([a-zA-Z]:)/, '$1')

// Regression test for a real bug found in four separate files: the pickup/
// return complete-confirm dialog and two Truck sub-pages' sticky-action bar
// imported their classNames from components/driver-v3/driver-v3.module.css,
// a file that only @imports its two split CSS files without re-exporting
// their class-name maps. Every className resolved to undefined, so the
// confirm dialog rendered with no backdrop/fixed-position/z-index (it just
// appeared inline and collided with the card and button behind it), and the
// sticky action bar silently lost its positioning and gradient background.
function listFilesRecursive(dir) {
  const out = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    const stat = statSync(full)
    if (stat.isDirectory()) out.push(...listFilesRecursive(full))
    else if (/\.(tsx?|jsx?)$/.test(entry)) out.push(full)
  }
  return out
}

test('No Driver page imports styles from the combined driver-v3.module.css (it re-exports no classNames)', () => {
  const files = [
    ...listFilesRecursive(join(root, 'app', 'driver-v3')),
    ...listFilesRecursive(join(root, 'components', 'driver-v3')),
  ]
  const offenders = []
  for (const file of files) {
    const content = readFileSync(file, 'utf8')
    if (/from ['"][^'"]*\/driver-v3\.module\.css['"]/.test(content)) offenders.push(file)
  }
  assert.deepEqual(offenders, [], `these files import from the combined driver-v3.module.css, which only @imports its split files and re-exports no classNames - every className read from it resolves to undefined: ${offenders.join(', ')}`)
})

test('Driver complete-confirm dialogs import their styles from a module that actually defines them', () => {
  const stylesModule = read('../components/driver-v3/driver-v3-b.module.css')

  for (const pagePath of ['../app/driver-v3/page.tsx', '../app/driver-v3/settings/page.tsx']) {
    const page = read(pagePath)
    if (!/confirmStyles\./.test(page)) continue // this page has no confirm dialog
    const importLine = page.match(/import confirmStyles from '([^']+)'/)
    assert.ok(importLine, `${pagePath} should import confirmStyles`)
    assert.match(importLine[1], /driver-v3-b\.module\.css$/, `${pagePath}: confirmStyles must come from driver-v3-b.module.css`)
  }

  for (const className of ['confirmBackdrop', 'confirmSheet', 'confirmActions']) {
    assert.match(stylesModule, new RegExp(`\\.${className}\\s*\\{`), `driver-v3-b.module.css should actually define .${className}`)
  }

  // The backdrop must be a real fixed overlay, not an inline block - this is
  // the exact property that was silently missing when the import was wrong.
  const backdropRule = stylesModule.match(/\.confirmBackdrop\{([^}]*)\}/)
  assert.ok(backdropRule, '.confirmBackdrop rule should exist')
  assert.match(backdropRule[1], /position\s*:\s*fixed/, '.confirmBackdrop must be position:fixed so it overlays the screen instead of sitting inline in the page flow')
  assert.match(backdropRule[1], /z-index\s*:\s*\d/, '.confirmBackdrop must set a z-index so it renders above the hero card and CTA button')
})

test('Truck fuel/maintenance sticky action bar imports its styles from a module that actually defines them', () => {
  const shellStylesA = read('../components/driver-v3/driver-v3-a.module.css')
  assert.match(shellStylesA, /\.stickyAction\s*\{/, 'driver-v3-a.module.css should define .stickyAction')

  for (const pagePath of ['../app/driver-v3/truck/fuel/page.tsx', '../app/driver-v3/truck/maintenance/page.tsx']) {
    const page = read(pagePath)
    const importLine = page.match(/import shellStyles from '([^']+)'/)
    assert.ok(importLine, `${pagePath} should import shellStyles`)
    assert.match(importLine[1], /driver-v3-a\.module\.css$/, `${pagePath}: shellStyles must come from driver-v3-a.module.css, which actually defines .stickyAction`)
  }
})
