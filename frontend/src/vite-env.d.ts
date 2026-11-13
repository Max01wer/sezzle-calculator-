/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL of the Go API, e.g. http://localhost:8080. Empty = same origin. */
  readonly VITE_API_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
