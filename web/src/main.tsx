import React from "react"
import ReactDOM from "react-dom/client"
import { BrowserRouter } from "react-router-dom"

import { App } from "./App"
import { AppSettingsProvider } from "./app-settings"
import { I18nProvider } from "./i18n"
import { WebPrefsProvider } from "./web-prefs"
import "./styles.css"

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <I18nProvider>
      <WebPrefsProvider>
        <AppSettingsProvider>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </AppSettingsProvider>
      </WebPrefsProvider>
    </I18nProvider>
  </React.StrictMode>,
)
