export interface PreviewConfig {
  taskId: string
  instanceId: string
  port: number
  baseUrl: string
  worktreeDir: string
  envVars: Record<string, string>
}

export interface BuildResult {
  success: boolean
  outputDir: string
  isStatic: boolean
  error?: string
}

export interface ServerInfo {
  pid: number
  port: number
  command: string
  isStaticServer: boolean
}

export interface PreviewAdapter {
  name: string

  /** Detect if this adapter applies to the project */
  detect(worktreeDir: string): Promise<boolean>

  /** Build the project for preview */
  build(config: PreviewConfig): Promise<BuildResult>

  /** Start serving the built output */
  start(config: PreviewConfig, buildResult: BuildResult): Promise<ServerInfo>

  /** Stop the preview server */
  stop(serverInfo: ServerInfo): Promise<void>
}
