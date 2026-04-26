import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router-dom"
import { describe, expect, it } from "vitest"

import { App } from "./App"
import { AppSettingsProvider } from "./app-settings"
import { I18nProvider } from "./i18n"
import { WebPrefsProvider } from "./web-prefs"

describe("settings language selection", () => {
  it("lets the user switch the shell from English to French", async () => {
    const user = userEvent.setup()

    render(
      <I18nProvider>
        <WebPrefsProvider>
          <AppSettingsProvider>
            <MemoryRouter initialEntries={["/settings"]}>
              <App />
            </MemoryRouter>
          </AppSettingsProvider>
        </WebPrefsProvider>
      </I18nProvider>,
    )

    expect(screen.getByRole("heading", { name: "Settings", level: 2 })).toBeInTheDocument()

    const language = screen.getByLabelText("Display language")
    await user.selectOptions(language, "fr")

    expect(screen.getByRole("link", { name: "Tableau de bord" })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Parametres" })).toBeInTheDocument()
  })
})
