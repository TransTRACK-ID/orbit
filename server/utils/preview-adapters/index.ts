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
  for (const adapter of adapters) {
    if (await adapter.detect(worktreeDir)) {
      return adapter
    }
  }
  return null
}

export { NuxtAdapter, NextJsAdapter, LaravelAdapter }
export type { PreviewAdapter, PreviewConfig, BuildResult, ServerInfo } from './types'
