import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')

// Regression test for a real bug: the pickup/return complete-confirm dialog
// used to import its classNames from components/driver-v3/driver-v3.module.css,
// a file that only @imports its two split CSS files without re-exporting
// their class-name maps. Every className resolved to undefined, so the
// dialog rendered with no backdrop, no fixed position, and no z-index - it
// just appeared inline and visually collided with the card and CTA button
// behind it.
test('Driver complete-confirm dialog imports its styles from a module that actually defines them', () => {
  const page = read('../app/driver-v3/page.tsx')
  const stylesModule = read('../components/driver-v3/driver-v3-b.module.css')

  const importLine = page.match(/import confirmStyles from '([^']+)'/)
  assert.ok(importLine, 'page.tsx should import confirmStyles')
  assert.match(importLine[1], /driver-v3-b\.module\.css$/, 'confirmStyles must come from driver-v3-b.module.css, which defines confirmBackdrop/confirmSheet/confirmActions - not the combined driver-v3.module.css, which only @imports other files and re-exports nothing')

  for (const className of ['confirmBackdrop', 'confirmSheet', 'confirmActions']) {
    assert.match(page, new RegExp(`confirmStyles\\.${className}\\b`), `page.tsx should reference confirmStyles.${className}`)
    assert.match(stylesModule, new RegExp(`\\.${className}\\s*\\{`), `driver-v3-b.module.css should actually define .${className}`)
  }

  // The backdrop must be a real fixed overlay, not an inline block - this is
  // the exact property that was silently missing when the import was wrong.
  const backdropRule = stylesModule.match(/\.confirmBackdrop\{([^}]*)\}/)
  assert.ok(backdropRule, '.confirmBackdrop rule should exist')
  assert.match(backdropRule[1], /position\s*:\s*fixed/, '.confirmBackdrop must be position:fixed so it overlays the screen instead of sitting inline in the page flow')
  assert.match(backdropRule[1], /z-index\s*:\s*\d/, '.confirmBackdrop must set a z-index so it renders above the hero card and CTA button')
})

test('The combined driver-v3.module.css is never imported for these dialog classNames anywhere in Driver', () => {
  const page = read('../app/driver-v3/page.tsx')
  assert.doesNotMatch(page, /from ['"][^'"]*\/driver-v3\.module\.css['"]/, 'driver-v3.module.css only @imports its split files and re-exports no classNames - importing styles from it silently resolves every className to undefined')
})
