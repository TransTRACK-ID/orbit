import { NuxtAdapter } from './nuxt-adapter'
import { NextJsAdapter } from './nextjs-adapter'
import { LaravelAdapter } from './laravel-adapter'
import type { PreviewAdapter } from './types'

const adapters: PreviewAdapter[] = [
  NuxtAdapter,
  NextJsAdapter,
  LaravelAdapter,
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


