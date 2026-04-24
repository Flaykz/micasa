import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"

import { requestJSON } from "./api"
import type { SettingsResponse, SharedSettings } from "./types"

const emptySettings: SettingsResponse = {
  shared: {
    currency: "USD",
    unit_system: "imperial",
  },
  system: {
    address_autofill: false,
    documents_max_file_size: "",
    documents_cache_ttl: "",
    chat_provider: "",
    chat_base_url: "",
    chat_model: "",
    chat_timeout: "",
    extraction_max_pages: 0,
    extraction_ocr_enabled: false,
    extraction_llm_enabled: false,
  },
}

type AppSettingsContextValue = {
  settings: SettingsResponse
  loading: boolean
  error: string
  reload: () => Promise<void>
  saveShared: (shared: SharedSettings) => Promise<void>
}

const AppSettingsContext = createContext<AppSettingsContextValue | null>(null)

export function AppSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<SettingsResponse>(emptySettings)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  async function reload() {
    setLoading(true)
    setError("")
    try {
      const next = await requestJSON<SettingsResponse>("/api/settings")
      setSettings(next)
    } catch (err) {
      setError(err instanceof Error ? err.message : "unknown error")
    } finally {
      setLoading(false)
    }
  }

  async function saveShared(shared: SharedSettings) {
    const next = await requestJSON<SettingsResponse>("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shared }),
    })
    setSettings(next)
  }

  useEffect(() => {
    void reload()
  }, [])

  const value = useMemo<AppSettingsContextValue>(
    () => ({ settings, loading, error, reload, saveShared }),
    [settings, loading, error],
  )

  return <AppSettingsContext.Provider value={value}>{children}</AppSettingsContext.Provider>
}

export function useAppSettings() {
  const context = useContext(AppSettingsContext)
  if (!context) {
    throw new Error("useAppSettings must be used within AppSettingsProvider")
  }
  return context
}
