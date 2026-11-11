/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** API origin for builds that do not share an origin with the API, such as the Android APK. */
  readonly VITE_API_ORIGIN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
