import { useCallback, useEffect, useState } from "react"

type ResourceState<T> = {
  data: T
  loading: boolean
  error: string
  reload: () => void
}

export function useResource<T>(path: string, initial: T): ResourceState<T> {
  const [version, setVersion] = useState(0)
  const [state, setState] = useState<ResourceState<T>>({
    data: initial,
    loading: true,
    error: "",
    reload: () => undefined,
  })

  const reload = useCallback(() => {
    setVersion((current) => current + 1)
  }, [])

  useEffect(() => {
    let cancelled = false

    setState((current) => ({ ...current, loading: true, error: "", reload }))

    async function load() {
      try {
        const data = await requestJSON<T>(path)
        if (!cancelled) {
          setState({ data, loading: false, error: "", reload })
        }
      } catch (error) {
        if (!cancelled) {
          setState({
            data: initial,
            loading: false,
            error: error instanceof Error ? error.message : "unknown error",
            reload,
          })
        }
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [path, reload, version])

  return state
}

export async function requestJSON<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, init)
  if (!response.ok) {
    let message = `${response.status} ${response.statusText}`
    try {
      const body = (await response.json()) as { error?: string }
      if (body.error) {
        message = body.error
      }
    } catch {
      // Fall back to the HTTP status text when the body is not JSON.
    }
    throw new Error(message)
  }

  if (response.status === 204) {
    return undefined as T
  }

  return (await response.json()) as T
}
