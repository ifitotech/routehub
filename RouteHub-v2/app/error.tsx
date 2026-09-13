'use client'

import {useEffect} from 'react'
import {RefreshCw, TriangleAlert} from 'lucide-react'
import {reportAppError} from '../lib/error-reporting'

// Next's per-segment error boundary: a render crash anywhere below this
// used to show a blank page in production with nothing recorded anywhere.
// Reports the crash the same way AppErrorListener does, then offers a way
// back instead of a dead end.
export default function GlobalErrorBoundary({error, reset}: {error: Error & {digest?: string}; reset: () => void}) {
  useEffect(() => {
    void reportAppError({action: 'render_error', error, context: {kind: 'error_boundary', digest: error.digest}})
  }, [error])
  return (
    <main className="app" style={{minHeight: '100dvh', display: 'grid', placeItems: 'center', padding: 24}}>
      <section className="card" style={{maxWidth: 440, textAlign: 'center', padding: 'clamp(24px, 5vw, 40px)'}}>
        <div style={{display: 'grid', placeItems: 'center', width: 52, height: 52, margin: '0 auto 16px', borderRadius: 16, background: '#fff0f0', color: '#dc2626'}}><TriangleAlert size={26}/></div>
        <h1 style={{margin: '0 0 8px', fontSize: 20}}>Something went wrong</h1>
        <p className="muted" style={{margin: '0 0 20px'}}>The problem has been reported. Try again, or come back to this later.</p>
        <button type="button" className="primary" style={{display: 'inline-flex', alignItems: 'center', gap: 8, margin: '0 auto'}} onClick={reset}><RefreshCw size={16}/>Try again</button>
      </section>
    </main>
  )
}
