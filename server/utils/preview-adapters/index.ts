import { NuxtAdapter } from './nuxt-adapter'
import { NextJsAdapter } from './nextjs-adapter'
import { FlutterAdapter } from './flutter-adapter'
import { LaravelAdapter } from './laravel-adapter'
import { VueAdapter } from './vue-adapter'
import { ReactAdapter } from './react-adapter'
import type { PreviewAdapter } from './types'

const adapters: PreviewAdapter[] = [
  NuxtAdapter,
  NextJsAdapter,
  FlutterAdapter,
  LaravelAdapter,
  VueAdapter,
  ReactAdapter,
]

export async function detectFramework(worktreeDir: string): Promise<PreviewAdapter | null> {
  console.log(`[adapter-registry] Detecting framework in ${worktreeDir}`)
  for (const adapter of adapters) {
    console.log(`[adapter-registry] Trying ${adapter.name}...`)
    if (await adapter.detect(worktreeDir)) {
      console.log(`[adapter-registry] Matched ${adapter.name}`)
      return adapter
    }
  }
  console.log(`[adapter-registry] No adapter matched`)
  return null
}


