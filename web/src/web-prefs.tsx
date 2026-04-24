import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"

export type DefaultRoute = "dashboard" | "projects" | "maintenance" | "incidents" | "documents"
export type Density = "comfortable" | "compact"

type WebPrefs = {
  defaultRoute: DefaultRoute
  confirmDestructiveActions: boolean
  density: Density
}

type WebPrefsContextValue = WebPrefs & {
  setDefaultRoute: (value: DefaultRoute) => void
  setConfirmDestructiveActions: (value: boolean) => void
  setDensity: (value: Density) => void
  confirmDestructive: (message: string) => boolean
}

const storageKeys = {
  defaultRoute: "micasa.web.default_route",
  confirmDestructiveActions: "micasa.web.confirm_destructive",
  density: "micasa.web.density",
}

const defaultPrefs: WebPrefs = {
  defaultRoute: "dashboard",
  confirmDestructiveActions: true,
  density: "comfortable",
}

const WebPrefsContext = createContext<WebPrefsContextValue | null>(null)

export function WebPrefsProvider({ children }: { children: ReactNode }) {
  const [defaultRoute, setDefaultRouteState] = useState<DefaultRoute>(() => {
    if (typeof window === "undefined") {
      return defaultPrefs.defaultRoute
    }
    const stored = window.localStorage.getItem(storageKeys.defaultRoute)
    switch (stored) {
      case "projects":
      case "maintenance":
      case "incidents":
      case "documents":
      case "dashboard":
        return stored
      default:
        return defaultPrefs.defaultRoute
    }
  })
  const [confirmDestructiveActions, setConfirmDestructiveActionsState] = useState<boolean>(() => {
    if (typeof window === "undefined") {
      return defaultPrefs.confirmDestructiveActions
    }
    const stored = window.localStorage.getItem(storageKeys.confirmDestructiveActions)
    if (stored === "false") {
      return false
    }
    return true
  })
  const [density, setDensityState] = useState<Density>(() => {
    if (typeof window === "undefined") {
      return defaultPrefs.density
    }
    return window.localStorage.getItem(storageKeys.density) === "compact" ? "compact" : "comfortable"
  })

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(storageKeys.defaultRoute, defaultRoute)
    }
  }, [defaultRoute])

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(storageKeys.confirmDestructiveActions, String(confirmDestructiveActions))
    }
  }, [confirmDestructiveActions])

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(storageKeys.density, density)
      document.documentElement.dataset.density = density
    }
  }, [density])

  const value = useMemo<WebPrefsContextValue>(() => ({
    defaultRoute,
    confirmDestructiveActions,
    density,
    setDefaultRoute: setDefaultRouteState,
    setConfirmDestructiveActions: setConfirmDestructiveActionsState,
    setDensity: setDensityState,
    confirmDestructive: (message: string) => !confirmDestructiveActions || window.confirm(message),
  }), [defaultRoute, confirmDestructiveActions, density])

  return <WebPrefsContext.Provider value={value}>{children}</WebPrefsContext.Provider>
}

export function useWebPrefs() {
  const context = useContext(WebPrefsContext)
  if (!context) {
    throw new Error("useWebPrefs must be used within WebPrefsProvider")
  }
  return context
}
