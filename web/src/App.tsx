import { useEffect, useState, type ChangeEvent, type FormEvent, type ReactNode } from "react"
import {
  Link,
  Navigate,
  NavLink,
  Route,
  Routes,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom"

import { requestJSON, useResource } from "./api"
import { useAppSettings } from "./app-settings"
import { getCurrentLocale, translatePhrase, type Language, useI18n } from "./i18n"
import type {
  Appliance,
  DashboardResponse,
  Document,
  HouseProfile,
  Incident,
  MaintenanceCategory,
  MaintenanceItem,
  Project,
  ProjectType,
  Quote,
  ServiceLogEntry,
  TrashItem,
  Vendor,
} from "./types"
import { type DefaultRoute, type Density, useWebPrefs } from "./web-prefs"

const emptyDashboard: DashboardResponse = {
  incidents: [],
  maintenance: [],
  active_projects: [],
  expiring_warranties: [],
  house: undefined,
  recent_service_logs: [],
  ytd_service_spend_cents: 0,
  total_project_spend_cents: 0,
  currency_code: "USD",
}

const emptyProject: Project = {
  id: "",
  title: "",
  project_type_id: "",
  status: "planned",
  description: "",
  start_date: null,
  end_date: null,
  budget_cents: null,
  actual_cents: null,
  created_at: "",
  updated_at: "",
}

const emptyVendor: Vendor = {
  id: "",
  name: "",
  contact_name: "",
  email: "",
  phone: "",
  website: "",
  notes: "",
  locale: "",
  created_at: "",
  updated_at: "",
}

const emptyAppliance: Appliance = {
  id: "",
  name: "",
  brand: "",
  model_number: "",
  serial_number: "",
  purchase_date: null,
  warranty_expiry: null,
  location: "",
  cost_cents: null,
  notes: "",
  created_at: "",
  updated_at: "",
}

const emptyMaintenance: MaintenanceItem = {
  id: "",
  name: "",
  category_id: "",
  appliance_id: null,
  season: "",
  last_serviced_at: null,
  interval_months: 0,
  due_date: null,
  notes: "",
  cost_cents: null,
  created_at: "",
  updated_at: "",
}

const emptyIncident: Incident = {
  id: "",
  title: "",
  description: "",
  status: "open",
  severity: "soon",
  date_noticed: "",
  date_resolved: null,
  location: "",
  cost_cents: null,
  appliance_id: null,
  vendor_id: null,
  notes: "",
  created_at: "",
  updated_at: "",
}

const emptyServiceLog: ServiceLogEntry = {
  id: "",
  maintenance_item_id: "",
  serviced_at: "",
  vendor_id: null,
  cost_cents: null,
  notes: "",
  created_at: "",
  updated_at: "",
}

const emptyQuote: Quote = {
  id: "",
  project_id: "",
  vendor_id: "",
  total_cents: 0,
  labor_cents: null,
  materials_cents: null,
  received_date: null,
  notes: "",
  created_at: "",
  updated_at: "",
}

const navItems = [
  { to: "/", key: "nav.dashboard" },
  { to: "/house", key: "nav.house" },
  { to: "/projects", key: "nav.projects" },
  { to: "/quotes", key: "nav.quotes" },
  { to: "/vendors", key: "nav.vendors" },
  { to: "/maintenance", key: "nav.maintenance" },
  { to: "/service-logs", key: "nav.service_logs" },
  { to: "/appliances", key: "nav.appliances" },
  { to: "/incidents", key: "nav.incidents" },
  { to: "/documents", key: "nav.documents" },
  { to: "/trash", key: "nav.trash" },
  { to: "/settings", key: "nav.settings" },
] as const

const projectStatusOptions = [
  { value: "ideating", label: "Ideating" },
  { value: "planned", label: "Planned" },
  { value: "quoted", label: "Quoted" },
  { value: "underway", label: "Underway" },
  { value: "delayed", label: "Delayed" },
  { value: "completed", label: "Completed" },
  { value: "abandoned", label: "Abandoned" },
]

const incidentStatusOptions = [
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In progress" },
  { value: "resolved", label: "Resolved" },
]

const incidentSeverityOptions = [
  { value: "urgent", label: "Urgent" },
  { value: "soon", label: "Soon" },
  { value: "whenever", label: "Whenever" },
]

const documentEntityOptions = [
  { value: "", label: "No linked record" },
  { value: "project", label: "Project" },
  { value: "appliance", label: "Appliance" },
  { value: "vendor", label: "Vendor" },
  { value: "quote", label: "Quote" },
  { value: "maintenance", label: "Maintenance" },
  { value: "incident", label: "Incident" },
]

type HouseDraft = {
  nickname: string
  addressLine1: string
  addressLine2: string
  city: string
  state: string
  postalCode: string
  yearBuilt: string
  squareFeet: string
  lotSquareFeet: string
  bedrooms: string
  bathrooms: string
}

type ProjectDraft = {
  title: string
  projectTypeID: string
  status: string
  description: string
  startDate: string
  endDate: string
  budget: string
  actual: string
}

type VendorDraft = {
  name: string
  contactName: string
  email: string
  phone: string
  website: string
  notes: string
  locale: string
}

type QuoteDraft = {
  projectID: string
  vendorID: string
  total: string
  labor: string
  materials: string
  receivedDate: string
  notes: string
}

type ApplianceDraft = {
  name: string
  brand: string
  modelNumber: string
  serialNumber: string
  purchaseDate: string
  warrantyExpiry: string
  location: string
  cost: string
  notes: string
}

type MaintenanceDraft = {
  name: string
  categoryID: string
  applianceID: string
  season: string
  lastServicedAt: string
  intervalMonths: string
  dueDate: string
  notes: string
  cost: string
}

type IncidentDraft = {
  title: string
  description: string
  status: string
  severity: string
  dateNoticed: string
  dateResolved: string
  location: string
  cost: string
  applianceID: string
  vendorID: string
  notes: string
}

type DocumentDraft = {
  title: string
  entityKind: string
  entityID: string
  notes: string
}

type ServiceLogDraft = {
  maintenanceItemID: string
  servicedAt: string
  vendorID: string
  cost: string
  notes: string
}

export function App() {
  const { t } = useI18n()
  const { density } = useWebPrefs()

  return (
    <div className={`shell shell-${density}`}>
      <header className="masthead">
        <div className="masthead-copy">
          <p className="eyebrow">{t("masthead.eyebrow")}</p>
          <h1>micasa</h1>
          <p className="lede">{t("masthead.lede")}</p>
        </div>
        <div className="masthead-notes" aria-label="Project highlights">
          <article className="masthead-card">
            <span>{t("masthead.one_binary")}</span>
            <strong>{t("masthead.shared_core")}</strong>
            <p>{t("masthead.shared_core_note")}</p>
          </article>
          <article className="masthead-card masthead-card-accent">
            <span>{t("masthead.workspace")}</span>
            <strong>{t("masthead.workspace_note_title")}</strong>
            <p>{t("masthead.workspace_note")}</p>
          </article>
        </div>
      </header>

      <div className="workspace">
        <aside className="rail-panel">
          <div className="rail-panel-head">
            <span className="eyebrow">{t("rail.eyebrow")}</span>
            <p>{t("rail.note")}</p>
          </div>
          <nav className="rail" aria-label="Primary">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  isActive ? "rail-link rail-link-active" : "rail-link"
                }
                end={item.to === "/"}
              >
                {t(item.key)}
              </NavLink>
            ))}
          </nav>
        </aside>

        <div className="content-stage">
          <Routes>
            <Route path="/" element={<HomeRoute />} />
            <Route path="/house" element={<HousePage />} />
            <Route path="/projects" element={<ProjectsPage />} />
            <Route path="/projects/new" element={<ProjectCreatePage />} />
            <Route path="/projects/:projectId" element={<ProjectDetailPage />} />
            <Route path="/projects/:projectId/edit" element={<ProjectEditPage />} />
            <Route path="/quotes" element={<QuotesPage />} />
            <Route path="/quotes/new" element={<QuoteCreatePage />} />
            <Route path="/quotes/:quoteId" element={<QuoteDetailPage />} />
            <Route path="/quotes/:quoteId/edit" element={<QuoteEditPage />} />
            <Route path="/vendors" element={<VendorsPage />} />
            <Route path="/vendors/new" element={<VendorCreatePage />} />
            <Route path="/vendors/:vendorId" element={<VendorDetailPage />} />
            <Route path="/vendors/:vendorId/edit" element={<VendorEditPage />} />
            <Route path="/maintenance" element={<MaintenancePage />} />
            <Route path="/maintenance/new" element={<MaintenanceCreatePage />} />
            <Route path="/maintenance/:maintenanceId" element={<MaintenanceDetailPage />} />
            <Route path="/maintenance/:maintenanceId/edit" element={<MaintenanceEditPage />} />
            <Route path="/service-logs" element={<ServiceLogsPage />} />
            <Route path="/service-logs/new" element={<ServiceLogCreatePage />} />
            <Route path="/service-logs/:serviceLogId" element={<ServiceLogDetailPage />} />
            <Route path="/service-logs/:serviceLogId/edit" element={<ServiceLogEditPage />} />
            <Route path="/appliances" element={<AppliancesPage />} />
            <Route path="/appliances/new" element={<ApplianceCreatePage />} />
            <Route path="/appliances/:applianceId" element={<ApplianceDetailPage />} />
            <Route path="/appliances/:applianceId/edit" element={<ApplianceEditPage />} />
            <Route path="/incidents" element={<IncidentsPage />} />
            <Route path="/incidents/new" element={<IncidentCreatePage />} />
            <Route path="/incidents/:incidentId" element={<IncidentDetailPage />} />
            <Route path="/incidents/:incidentId/edit" element={<IncidentEditPage />} />
            <Route path="/documents" element={<DocumentsPage />} />
            <Route path="/documents/new" element={<DocumentCreatePage />} />
            <Route path="/documents/:documentId" element={<DocumentDetailPage />} />
            <Route path="/documents/:documentId/edit" element={<DocumentEditPage />} />
            <Route path="/trash" element={<TrashPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </div>
      </div>
    </div>
  )
}

function HomeRoute() {
  const { defaultRoute } = useWebPrefs()

  switch (defaultRoute) {
    case "projects":
      return <Navigate to="/projects" replace />
    case "maintenance":
      return <Navigate to="/maintenance" replace />
    case "incidents":
      return <Navigate to="/incidents" replace />
    case "documents":
      return <Navigate to="/documents" replace />
    default:
      return <DashboardPage />
  }
}

function SettingsPage() {
  const { language, setLanguage, t, tx } = useI18n()
  const { settings, loading, error, saveShared } = useAppSettings()
  const {
    defaultRoute,
    setDefaultRoute,
    confirmDestructiveActions,
    setConfirmDestructiveActions,
    density,
    setDensity,
  } = useWebPrefs()
  const [currency, setCurrency] = useState(settings.shared.currency)
  const [unitSystem, setUnitSystem] = useState(settings.shared.unit_system)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState("")

  useEffect(() => {
    setCurrency(settings.shared.currency)
    setUnitSystem(settings.shared.unit_system)
  }, [settings.shared.currency, settings.shared.unit_system])

  async function handleSharedSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setSaveError("")
    try {
      await saveShared({ currency, unit_system: unitSystem })
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "unknown error")
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="view">
      <PageHeader title={t("settings.title")} note={t("settings.note")} />
      {error ? <InlineError message={error} /> : null}
      <section className="detail-grid">
        <Panel title={t("settings.shared_title")} note={t("settings.shared_note")}>
          {saveError ? <InlineError message={saveError} /> : null}
          <form className="form-grid" onSubmit={handleSharedSave}>
            <FormField label={t("settings.currency")}>
              <input value={currency} onChange={(event) => setCurrency(event.target.value.toUpperCase())} disabled={loading || saving} />
            </FormField>
            <FormField label={t("settings.unit_system")}>
              <select value={unitSystem} onChange={(event) => setUnitSystem(event.target.value)} disabled={loading || saving}>
				<option value="imperial">{tx("imperial")}</option>
				<option value="metric">{tx("metric")}</option>
			</select>
		</FormField>
            <div className="form-actions">
              <button className="button-primary" type="submit" disabled={loading || saving}>{saving ? tx("Saving...") : tx("Save changes")}</button>
            </div>
          </form>
        </Panel>
        <Panel title={t("settings.title")} note={t("settings.language_note")}>
          <form className="form-grid">
            <FormField label={t("settings.language_label")}>
              <select
                aria-label={t("settings.language_label")}
                value={language}
                onChange={(event) => setLanguage(event.target.value as Language)}
              >
                <option value="en">{t("settings.language_english")}</option>
                <option value="fr">{t("settings.language_french")}</option>
              </select>
            </FormField>
            <FormField label={t("settings.default_route")}>
              <select value={defaultRoute} onChange={(event) => setDefaultRoute(event.target.value as DefaultRoute)}>
                <option value="dashboard">{t("settings.dashboard")}</option>
                <option value="projects">{t("settings.projects")}</option>
                <option value="maintenance">{t("settings.maintenance")}</option>
                <option value="incidents">{t("settings.incidents")}</option>
                <option value="documents">{t("settings.documents")}</option>
              </select>
            </FormField>
            <FormField label={t("settings.confirm_destructive")}> 
              <select value={confirmDestructiveActions ? "true" : "false"} onChange={(event) => setConfirmDestructiveActions(event.target.value === "true")}>
				<option value="true">{t("settings.enabled")}</option>
				<option value="false">{t("settings.disabled")}</option>
			</select>
		</FormField>
			<FormField label={t("settings.density")}>
				<select value={density} onChange={(event) => setDensity(event.target.value as Density)}>
					<option value="comfortable">{t("settings.comfortable")}</option>
					<option value="compact">{t("settings.compact")}</option>
				</select>
			</FormField>
		</form>
	</Panel>
        <Panel title={t("settings.preview_title")} note={t("settings.language_note")}>
          <p className="body-copy">{t("settings.preview_text")}</p>
        </Panel>
		<Panel title={t("settings.system_title")} note={t("settings.system_note")}>
			<DetailList
				rows={[
					[t("settings.address_autofill"), settings.system.address_autofill ? t("settings.enabled") : t("settings.disabled")],
					[t("settings.documents_max_file_size"), settings.system.documents_max_file_size || "-"],
					[t("settings.documents_cache_ttl"), settings.system.documents_cache_ttl || "-"],
					[t("settings.chat_provider"), settings.system.chat_provider || "-"],
					[t("settings.chat_model"), settings.system.chat_model || "-"],
					[t("settings.chat_base_url"), settings.system.chat_base_url || "-"],
					[t("settings.chat_timeout"), settings.system.chat_timeout || "-"],
					[t("settings.extraction_max_pages"), String(settings.system.extraction_max_pages)],
					[t("settings.ocr_extraction"), settings.system.extraction_ocr_enabled ? t("settings.enabled") : t("settings.disabled")],
					[t("settings.llm_extraction"), settings.system.extraction_llm_enabled ? t("settings.enabled") : t("settings.disabled")],
				]}
			/>
		</Panel>
      </section>
    </main>
  )
}

function DashboardPage() {
  const { data, loading, error } = useResource<DashboardResponse>("/api/dashboard", emptyDashboard)
  const house = normalizeHouse(data.house)
  const { t, tx } = useI18n()

  return (
    <main className="view">
      <PageHeader title={t("dashboard.title")} note={t("dashboard.note")} />
      <StateGate loading={loading} error={error} empty={false}>
        <section className="summary-grid">
          <SummaryCard
            label={t("dashboard.open_incidents")}
            value={data.incidents.length}
            note={data.incidents.length ? t("state.needs_attention") : t("state.quiet_house")}
          />
          <SummaryCard
            label={t("dashboard.active_projects")}
            value={data.active_projects.length}
            note={formatMoney(data.total_project_spend_cents, data.currency_code)}
          />
          <SummaryCard
            label={t("dashboard.scheduled_maintenance")}
            value={data.maintenance.length}
            note={`${data.recent_service_logs.length} ${tx("recent logs")}`}
          />
          <SummaryCard
            label={t("dashboard.warranty_watch")}
            value={data.expiring_warranties.length}
            note={formatMoney(data.ytd_service_spend_cents, data.currency_code)}
          />
        </section>

        <section className="dashboard-grid">
          <Panel
            title="House profile"
            note={house ? joinMeta([house.nickname, house.city, house.state]) : "Setup pending"}
            actions={<Link className="button-link" to="/house">{house ? tx("View or edit") : tx("Create profile")}</Link>}
          >
            <HouseCard house={house} />
          </Panel>
          <Panel title="Incidents in play" note={`${data.incidents.length} ${tx("active")}`}>
            {data.incidents.length === 0 ? (
              <EmptyRecord message="Nothing urgent right now." />
            ) : (
              data.incidents.slice(0, 5).map((incident) => (
                <RecordCard
                  key={incident.id}
                  title={incident.title}
                  badge={statusBadge(incident.status || incident.severity)}
                  subtitle={incident.location || incident.description || tx("No incident detail")}
                  meta={joinMeta([
                    incident.severity ? incident.severity.replaceAll("_", " ") : "",
                    formatDate(incident.date_noticed),
                  ])}
                />
              ))
            )}
          </Panel>
          <Panel title="Recent service" note={`${data.recent_service_logs.length} ${tx("entries")}`}>
            {data.recent_service_logs.length === 0 ? (
              <EmptyRecord message="No service logs yet." />
            ) : (
              data.recent_service_logs.map((entry) => (
                <RecordCard
                  key={entry.id}
                  title={entry.notes || tx("Service entry")}
                  subtitle={formatDate(entry.serviced_at)}
                  meta={joinMeta([
                    formatMoney(entry.cost_cents, data.currency_code),
                    entry.maintenance_item_id,
                  ])}
                />
              ))
            )}
          </Panel>
          <Panel
            title="Active projects"
            note={`${data.active_projects.length} ${tx("live")}`}
            actions={<Link className="button-link" to="/projects">{tx("Open all")}</Link>}
          >
            {data.active_projects.length === 0 ? (
              <EmptyRecord message="No active work in flight." />
            ) : (
              data.active_projects.slice(0, 5).map((project) => (
                <RecordCard
                  key={project.id}
                  title={project.title}
                  badge={statusBadge(project.status)}
                  subtitle={project.description || tx("No project description")}
                  meta={joinMeta([
                    project.start_date ? `${tx("Started")} ${formatDate(project.start_date)}` : tx("No start date"),
                    formatMoney(project.actual_cents ?? project.budget_cents, data.currency_code),
                  ])}
                  to={`/projects/${project.id}`}
                />
              ))
            )}
          </Panel>
          <Panel title="Warranty watch" note={`${data.expiring_warranties.length} ${tx("upcoming")}`}>
            {data.expiring_warranties.length === 0 ? (
              <EmptyRecord message="No warranties expiring soon." />
            ) : (
              data.expiring_warranties.map((appliance) => (
                <RecordCard
                  key={appliance.id}
                  title={appliance.name}
                  badge={statusBadge("expiring")}
                  subtitle={joinMeta([appliance.brand, appliance.model_number]) || tx("No model details")}
                  meta={joinMeta([
                     appliance.warranty_expiry ? `${tx("Warranty")} ${formatDate(appliance.warranty_expiry)}` : tx("No warranty date"),
                    appliance.location,
                  ])}
                />
              ))
            )}
          </Panel>
        </section>
      </StateGate>
    </main>
  )
}

function HousePage() {
  const houseResource = useResource<HouseProfile | null>("/api/house", null)
  const { tx } = useI18n()
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState("")
  const [draft, setDraft] = useState<HouseDraft>(emptyHouseDraft())

  const house = normalizeHouse(houseResource.data)

  useEffect(() => {
    const next = house ? houseToDraft(house) : emptyHouseDraft()
    setDraft(next)
    setEditing(!house)
  }, [house?.id, house?.updated_at])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setSaveError("")

    try {
      await requestJSON<HouseProfile>("/api/house", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(housePayload(draft)),
      })
      houseResource.reload()
      setEditing(false)
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "unknown error")
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="view">
      <PageHeader
        title="House"
        note="The singleton house profile shared between the TUI and the browser."
      />
      <StateGate loading={houseResource.loading} error={houseResource.error} empty={false}>
        <section className="detail-grid">
          <Panel
            title="Profile"
            note={house ? joinMeta([house.nickname, house.city, house.state]) : "Not set yet"}
            actions={
              <div className="panel-actions">
                {editing ? null : (
                  <button className="button-link" type="button" onClick={() => setEditing(true)}>
                    {house ? tx("Edit") : tx("Create")}
                  </button>
                )}
              </div>
            }
          >
            <HouseCard house={house} />
          </Panel>

          <Panel
            title={house ? "Edit house profile" : "Create house profile"}
            note="Changes write straight into the same SQLite file used by the TUI."
          >
            {saveError ? <InlineError message={saveError} /> : null}
            <HouseForm
              draft={draft}
              disabled={saving}
              onChange={setDraft}
              onSubmit={handleSubmit}
              onCancel={
                house
                  ? () => {
                      setDraft(houseToDraft(house))
                      setEditing(false)
                      setSaveError("")
                    }
                  : undefined
              }
              showActions={editing || !house}
            />
          </Panel>
        </section>
      </StateGate>
    </main>
  )
}

function ProjectsPage() {
  const projects = useResource<Project[]>("/api/projects", [])
  const types = useResource<ProjectType[]>("/api/project-types", [])
  const dashboard = useResource<DashboardResponse>("/api/dashboard", emptyDashboard)
  const { tx } = useI18n()

  return (
    <main className="view">
      <PageHeader title="Projects" note="Planned, underway, delayed, and completed work." />
      <div className="page-actions">
        <Link className="button-primary" to="/projects/new">{tx("New project")}</Link>
      </div>
      <StateGate loading={projects.loading || types.loading} error={projects.error || types.error} empty={projects.data.length === 0}>
        <section className="list-grid">
          {projects.data.map((project) => (
            <RecordCard
              key={project.id}
              title={project.title}
              badge={statusBadge(project.status)}
              subtitle={project.description || projectTypeName(project.project_type_id, types.data)}
              meta={joinMeta([
                projectTypeName(project.project_type_id, types.data),
                project.start_date ? `${tx("Started")} ${formatDate(project.start_date)}` : tx("No start date"),
                formatMoney(project.actual_cents ?? project.budget_cents, dashboard.data.currency_code),
              ])}
              to={`/projects/${project.id}`}
            />
          ))}
        </section>
      </StateGate>
    </main>
  )
}

function ProjectDetailPage() {
  const { projectId = "" } = useParams()
  const navigate = useNavigate()
  const project = useResource<Project>(`/api/projects/${projectId}`, emptyProject)
  const quotes = useResource<Quote[]>(`/api/projects/${projectId}/quotes`, [])
  const vendors = useResource<Vendor[]>("/api/vendors", [])
  const types = useResource<ProjectType[]>("/api/project-types", [])
  const dashboard = useResource<DashboardResponse>("/api/dashboard", emptyDashboard)
  const { tx } = useI18n()
  const { confirmDestructive } = useWebPrefs()
  const [deleteError, setDeleteError] = useState("")
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    if (!confirmDestructive(tx("Delete this project? It will be soft-deleted and can still be restored later from a deeper admin surface."))) {
      return
    }

    setDeleting(true)
    setDeleteError("")

    try {
      await requestJSON<void>(`/api/projects/${projectId}`, { method: "DELETE" })
      navigate("/projects")
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : "unknown error")
    } finally {
      setDeleting(false)
    }
  }

  return (
    <main className="view">
      <PageHeader title="Project detail" note="Inspect and manage one project from the browser." />
      <div className="page-actions">
        <Link className="button-secondary" to="/projects">{tx("Back to projects")}</Link>
        <Link className="button-primary" to={`/projects/${projectId}/edit`}>{tx("Edit")}</Link>
        <button className="button-danger" type="button" onClick={handleDelete} disabled={deleting}>
          {deleting ? tx("Deleting...") : tx("Delete")}
        </button>
      </div>
      {deleteError ? <InlineError message={deleteError} /> : null}
      <StateGate
        loading={project.loading || types.loading || quotes.loading || vendors.loading}
        error={project.error || types.error || quotes.error || vendors.error}
        empty={!project.data.id}
      >
        <section className="detail-grid">
          <Panel title={project.data.title} note={projectTypeName(project.data.project_type_id, types.data)}>
            <DetailList
              rows={[
                ["Status", project.data.status],
                ["Type", projectTypeName(project.data.project_type_id, types.data)],
                ["Started", formatDate(project.data.start_date) || "-"],
                ["Ended", formatDate(project.data.end_date) || "-"],
                ["Budget", formatMoney(project.data.budget_cents, dashboard.data.currency_code) || "-"],
                ["Actual", formatMoney(project.data.actual_cents, dashboard.data.currency_code) || "-"],
                ["Updated", formatDate(project.data.updated_at) || "-"],
              ]}
            />
          </Panel>
          <Panel title="Description" note="Free-form project context visible to both interfaces.">
            <p className="body-copy">{project.data.description || tx("No description yet.")}</p>
          </Panel>
          <Panel
            title="Related quotes"
            note={quotes.data.length === 1 ? `${quotes.data.length} ${tx("quote")}` : `${quotes.data.length} ${tx("quotes")}`}
            actions={<Link className="button-link" to="/quotes/new">{tx("New quote")}</Link>}
          >
            {quotes.data.length === 0 ? (
              <EmptyRecord message="No quotes linked to this project yet." />
            ) : (
              quotes.data.map((quote) => (
                <RecordCard
                  key={quote.id}
                  title={formatMoney(quote.total_cents, dashboard.data.currency_code) || tx("Quote")}
                  subtitle={vendorName(quote.vendor_id, vendors.data)}
                  meta={joinMeta([
                    quote.received_date ? `${tx("Received")} ${formatDate(quote.received_date)}` : tx("No received date"),
                    quote.notes,
                  ])}
                  to={`/quotes/${quote.id}`}
                />
              ))
            )}
          </Panel>
        </section>
      </StateGate>
    </main>
  )
}

function ProjectCreatePage() {
  return <ProjectFormPage mode="create" />
}

function ProjectEditPage() {
  return <ProjectFormPage mode="edit" />
}

function ProjectFormPage({ mode }: { mode: "create" | "edit" }) {
  const { projectId = "" } = useParams()
  const navigate = useNavigate()
  const types = useResource<ProjectType[]>("/api/project-types", [])
  const project = mode === "edit" ? useResource<Project>(`/api/projects/${projectId}`, emptyProject) : null
  const [draft, setDraft] = useState<ProjectDraft>(emptyProjectDraft())
  const [submitError, setSubmitError] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const { tx } = useI18n()

  useEffect(() => {
    if (mode === "edit" && project?.data.id) {
      setDraft(projectToDraft(project.data))
    }
  }, [mode, project?.data.id, project?.data.updated_at])

  useEffect(() => {
    if (mode === "create" && types.data.length > 0 && !draft.projectTypeID) {
      setDraft((current) => ({ ...current, projectTypeID: types.data[0].id }))
    }
  }, [draft.projectTypeID, mode, types.data])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setSubmitError("")

    try {
      const payload = projectPayload(draft)
      if (mode === "create") {
        const created = await requestJSON<Project>("/api/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
        navigate(`/projects/${created.id}`)
      } else {
        const updated = await requestJSON<Project>(`/api/projects/${projectId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
        navigate(`/projects/${updated.id}`)
      }
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "unknown error")
    } finally {
      setSubmitting(false)
    }
  }

  const loading = types.loading || (mode === "edit" && Boolean(project?.loading))
  const error = types.error || (mode === "edit" ? project?.error ?? "" : "")

  return (
    <main className="view">
      <PageHeader
        title={mode === "create" ? "New project" : "Edit project"}
        note="This is the first full multi-row CRUD flow in the React frontend."
      />
      <div className="page-actions">
        <Link className="button-secondary" to={mode === "create" ? "/projects" : `/projects/${projectId}`}>
          {tx("Cancel")}
        </Link>
      </div>
      <StateGate loading={loading} error={error} empty={false}>
        <Panel
          title={mode === "create" ? "Create project" : "Update project"}
          note="Required fields mirror the existing Go data model."
        >
          {submitError ? <InlineError message={submitError} /> : null}
          <ProjectForm
            draft={draft}
            disabled={submitting}
            projectTypes={types.data}
            onChange={setDraft}
            onSubmit={handleSubmit}
            submitLabel={mode === "create" ? tx("Create project") : tx("Save changes")}
          />
        </Panel>
      </StateGate>
    </main>
  )
}

function VendorsPage() {
  const vendors = useResource<Vendor[]>("/api/vendors", [])
  const { tx } = useI18n()

  return (
    <main className="view">
      <PageHeader title="Vendors" note="Service providers, contractors, and repair contacts." />
      <div className="page-actions">
        <Link className="button-primary" to="/vendors/new">{tx("New vendor")}</Link>
      </div>
      <StateGate loading={vendors.loading} error={vendors.error} empty={vendors.data.length === 0}>
        <section className="list-grid">
          {vendors.data.map((vendor) => (
            <RecordCard
              key={vendor.id}
              title={vendor.name}
              badge={vendor.locale ? statusBadge(vendor.locale) : undefined}
              subtitle={vendor.contact_name || vendor.email || vendor.phone || "No contact details"}
              meta={joinMeta([vendor.website, vendor.notes])}
              to={`/vendors/${vendor.id}`}
            />
          ))}
        </section>
      </StateGate>
    </main>
  )
}

function VendorDetailPage() {
  const { vendorId = "" } = useParams()
  const navigate = useNavigate()
  const vendor = useResource<Vendor>(`/api/vendors/${vendorId}`, emptyVendor)
  const { tx } = useI18n()
  const { confirmDestructive } = useWebPrefs()
  const [deleteError, setDeleteError] = useState("")
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    if (!confirmDestructive(tx("Delete this vendor? Quotes or incidents still pointing to it will block the delete."))) {
      return
    }
    setDeleting(true)
    setDeleteError("")
    try {
      await requestJSON<void>(`/api/vendors/${vendorId}`, { method: "DELETE" })
      navigate("/vendors")
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : "unknown error")
    } finally {
      setDeleting(false)
    }
  }

  return (
    <main className="view">
      <PageHeader title="Vendor detail" note="Inspect and manage one vendor from the browser." />
      <div className="page-actions">
        <Link className="button-secondary" to="/vendors">{tx("Back to vendors")}</Link>
        <Link className="button-primary" to={`/vendors/${vendorId}/edit`}>{tx("Edit")}</Link>
        <button className="button-danger" type="button" onClick={handleDelete} disabled={deleting}>
          {deleting ? tx("Deleting...") : tx("Delete")}
        </button>
      </div>
      {deleteError ? <InlineError message={deleteError} /> : null}
      <StateGate loading={vendor.loading} error={vendor.error} empty={!vendor.data.id}>
        <section className="detail-grid">
          <Panel title={vendor.data.name} note={vendor.data.locale || "Vendor"}>
            <DetailList
              rows={[
                ["Contact", vendor.data.contact_name || "-"],
                ["Email", vendor.data.email || "-"],
                ["Phone", vendor.data.phone || "-"],
                ["Website", vendor.data.website || "-"],
                ["Locale", vendor.data.locale || "-"],
                ["Updated", formatDate(vendor.data.updated_at) || "-"],
              ]}
            />
          </Panel>
          <Panel title="Notes" note="Shared vendor notes visible in both interfaces.">
            <p className="body-copy">{vendor.data.notes || tx("No notes yet.")}</p>
          </Panel>
        </section>
      </StateGate>
    </main>
  )
}

function VendorCreatePage() {
  return <VendorFormPage mode="create" />
}

function VendorEditPage() {
  return <VendorFormPage mode="edit" />
}

function VendorFormPage({ mode }: { mode: "create" | "edit" }) {
  const { vendorId = "" } = useParams()
  const navigate = useNavigate()
  const vendor = mode === "edit" ? useResource<Vendor>(`/api/vendors/${vendorId}`, emptyVendor) : null
  const [draft, setDraft] = useState<VendorDraft>(emptyVendorDraft())
  const [submitError, setSubmitError] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const { tx } = useI18n()

  useEffect(() => {
    if (mode === "edit" && vendor?.data.id) {
      setDraft(vendorToDraft(vendor.data))
    }
  }, [mode, vendor?.data.id, vendor?.data.updated_at])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setSubmitError("")
    try {
      const payload = vendorPayload(draft)
      if (mode === "create") {
        const created = await requestJSON<Vendor>("/api/vendors", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
        navigate(`/vendors/${created.id}`)
      } else {
        const updated = await requestJSON<Vendor>(`/api/vendors/${vendorId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
        navigate(`/vendors/${updated.id}`)
      }
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "unknown error")
    } finally {
      setSubmitting(false)
    }
  }

  const loading = mode === "edit" && Boolean(vendor?.loading)
  const error = mode === "edit" ? vendor?.error ?? "" : ""

  return (
    <main className="view">
      <PageHeader title={mode === "create" ? "New vendor" : "Edit vendor"} note="Track the people and companies you hire for work." />
      <div className="page-actions">
        <Link className="button-secondary" to={mode === "create" ? "/vendors" : `/vendors/${vendorId}`}>
          {tx("Cancel")}
        </Link>
      </div>
      <StateGate loading={loading} error={error} empty={false}>
        <Panel title={mode === "create" ? "Create vendor" : "Update vendor"} note="Simple contact information with no separate backend service.">
          {submitError ? <InlineError message={submitError} /> : null}
          <VendorForm draft={draft} disabled={submitting} onChange={setDraft} onSubmit={handleSubmit} submitLabel={mode === "create" ? tx("Create vendor") : tx("Save changes")} />
        </Panel>
      </StateGate>
    </main>
  )
}

function QuotesPage() {
  const quotes = useResource<Quote[]>("/api/quotes", [])
  const vendors = useResource<Vendor[]>("/api/vendors", [])
  const projects = useResource<Project[]>("/api/projects", [])
  const dashboard = useResource<DashboardResponse>("/api/dashboard", emptyDashboard)
  const { tx } = useI18n()

  return (
    <main className="view">
      <PageHeader title="Quotes" note="Vendor pricing snapshots attached to projects." />
      <div className="page-actions">
        <Link className="button-primary" to="/quotes/new">{tx("New quote")}</Link>
      </div>
      <StateGate loading={quotes.loading || vendors.loading || projects.loading} error={quotes.error || vendors.error || projects.error} empty={quotes.data.length === 0}>
        <section className="list-grid">
          {quotes.data.map((quote) => (
            <RecordCard
              key={quote.id}
                  title={formatMoney(quote.total_cents, dashboard.data.currency_code) || tx("Quote")}
              subtitle={projectName(quote.project_id, projects.data)}
              meta={joinMeta([
                vendorName(quote.vendor_id, vendors.data),
                quote.received_date ? `${tx("Received")} ${formatDate(quote.received_date)}` : tx("No received date"),
                quote.notes,
              ])}
              to={`/quotes/${quote.id}`}
            />
          ))}
        </section>
      </StateGate>
    </main>
  )
}

function QuoteDetailPage() {
  const { quoteId = "" } = useParams()
  const navigate = useNavigate()
  const quote = useResource<Quote>(`/api/quotes/${quoteId}`, emptyQuote)
  const vendors = useResource<Vendor[]>("/api/vendors", [])
  const projects = useResource<Project[]>("/api/projects", [])
  const dashboard = useResource<DashboardResponse>("/api/dashboard", emptyDashboard)
  const { tx } = useI18n()
  const { confirmDestructive } = useWebPrefs()
  const [deleteError, setDeleteError] = useState("")
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    if (!confirmDestructive(tx("Delete this quote? This is a soft-delete in the shared SQLite database."))) {
      return
    }
    setDeleting(true)
    setDeleteError("")
    try {
      await requestJSON<void>(`/api/quotes/${quoteId}`, { method: "DELETE" })
      navigate("/quotes")
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : "unknown error")
    } finally {
      setDeleting(false)
    }
  }

  return (
    <main className="view">
      <PageHeader title="Quote detail" note="Inspect and manage one vendor quote from the browser." />
      <div className="page-actions">
        <Link className="button-secondary" to="/quotes">{tx("Back to quotes")}</Link>
        {entityPath("project", quote.data.project_id) ? (
          <Link className="button-link" to={entityPath("project", quote.data.project_id)!}>{tx("Open project")}</Link>
        ) : null}
        {entityPath("vendor", quote.data.vendor_id) ? (
          <Link className="button-link" to={entityPath("vendor", quote.data.vendor_id)!}>{tx("Open vendor")}</Link>
        ) : null}
        <Link className="button-primary" to={`/quotes/${quoteId}/edit`}>{tx("Edit")}</Link>
        <button className="button-danger" type="button" onClick={handleDelete} disabled={deleting}>
          {deleting ? tx("Deleting...") : tx("Delete")}
        </button>
      </div>
      {deleteError ? <InlineError message={deleteError} /> : null}
      <StateGate loading={quote.loading || vendors.loading || projects.loading} error={quote.error || vendors.error || projects.error} empty={!quote.data.id}>
        <section className="detail-grid">
          <Panel title={formatMoney(quote.data.total_cents, dashboard.data.currency_code) || tx("Quote")} note={vendorName(quote.data.vendor_id, vendors.data)}>
            <DetailList
              rows={[
                ["Project", projectName(quote.data.project_id, projects.data)],
                ["Vendor", vendorName(quote.data.vendor_id, vendors.data)],
                ["Total", formatMoney(quote.data.total_cents, dashboard.data.currency_code) || "-"],
                ["Labor", formatMoney(quote.data.labor_cents, dashboard.data.currency_code) || "-"],
                ["Materials", formatMoney(quote.data.materials_cents, dashboard.data.currency_code) || "-"],
                ["Received", formatDate(quote.data.received_date) || "-"],
              ]}
            />
          </Panel>
          <Panel title="Notes" note="Free-form quote notes visible in both interfaces.">
            <p className="body-copy">{quote.data.notes || tx("No notes yet.")}</p>
          </Panel>
        </section>
      </StateGate>
    </main>
  )
}

function QuoteCreatePage() {
  return <QuoteFormPage mode="create" />
}

function QuoteEditPage() {
  return <QuoteFormPage mode="edit" />
}

function QuoteFormPage({ mode }: { mode: "create" | "edit" }) {
  const { quoteId = "" } = useParams()
  const navigate = useNavigate()
  const quote = mode === "edit" ? useResource<Quote>(`/api/quotes/${quoteId}`, emptyQuote) : null
  const projects = useResource<Project[]>("/api/projects", [])
  const vendors = useResource<Vendor[]>("/api/vendors", [])
  const [draft, setDraft] = useState<QuoteDraft>(emptyQuoteDraft())
  const [submitError, setSubmitError] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const { tx } = useI18n()

  useEffect(() => {
    if (mode === "edit" && quote?.data.id) {
      setDraft(quoteToDraft(quote.data))
    }
  }, [mode, quote?.data.id, quote?.data.updated_at])

  useEffect(() => {
    if (mode === "create") {
      setDraft((current) => ({
        ...current,
        projectID: current.projectID || projects.data[0]?.id || "",
        vendorID: current.vendorID || vendors.data[0]?.id || "",
      }))
    }
  }, [mode, projects.data, vendors.data])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setSubmitError("")
    try {
      const payload = quotePayload(draft)
      if (mode === "create") {
        const created = await requestJSON<Quote>("/api/quotes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
        navigate(`/quotes/${created.id}`)
      } else {
        const updated = await requestJSON<Quote>(`/api/quotes/${quoteId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
        navigate(`/quotes/${updated.id}`)
      }
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "unknown error")
    } finally {
      setSubmitting(false)
    }
  }

  const loading = projects.loading || vendors.loading || (mode === "edit" && Boolean(quote?.loading))
  const error = projects.error || vendors.error || (mode === "edit" ? quote?.error ?? "" : "")

  return (
    <main className="view">
      <PageHeader title={mode === "create" ? "New quote" : "Edit quote"} note="Attach a vendor price snapshot to a project." />
      <div className="page-actions">
        <Link className="button-secondary" to={mode === "create" ? "/quotes" : `/quotes/${quoteId}`}>
          {tx("Cancel")}
        </Link>
      </div>
      <StateGate loading={loading} error={error} empty={false}>
        <Panel title={mode === "create" ? "Create quote" : "Update quote"} note="Quote writes reuse the same Go data layer as the TUI.">
          {submitError ? <InlineError message={submitError} /> : null}
          <QuoteForm draft={draft} disabled={submitting} projects={projects.data} vendors={vendors.data} onChange={setDraft} onSubmit={handleSubmit} submitLabel={mode === "create" ? tx("Create quote") : tx("Save changes")} />
        </Panel>
      </StateGate>
    </main>
  )
}

function AppliancesPage() {
  const appliances = useResource<Appliance[]>("/api/appliances", [])
  const dashboard = useResource<DashboardResponse>("/api/dashboard", emptyDashboard)
  const { tx } = useI18n()

  return (
    <main className="view">
      <PageHeader title="Appliances" note="Inventory, warranty tracking, and equipment details." />
      <div className="page-actions">
        <Link className="button-primary" to="/appliances/new">{tx("New appliance")}</Link>
      </div>
      <StateGate loading={appliances.loading} error={appliances.error} empty={appliances.data.length === 0}>
        <section className="list-grid">
          {appliances.data.map((appliance) => (
            <RecordCard
              key={appliance.id}
              title={appliance.name}
              badge={appliance.location ? statusBadge(appliance.location) : undefined}
                  subtitle={joinMeta([appliance.brand, appliance.model_number]) || tx("No model details")}
              meta={joinMeta([
                appliance.warranty_expiry ? `${tx("Warranty")} ${formatDate(appliance.warranty_expiry)}` : tx("No warranty date"),
                formatMoney(appliance.cost_cents, dashboard.data.currency_code),
                appliance.serial_number,
              ])}
              to={`/appliances/${appliance.id}`}
            />
          ))}
        </section>
      </StateGate>
    </main>
  )
}

function ApplianceDetailPage() {
  const { applianceId = "" } = useParams()
  const navigate = useNavigate()
  const appliance = useResource<Appliance>(`/api/appliances/${applianceId}`, emptyAppliance)
  const maintenance = useResource<MaintenanceItem[]>(`/api/appliances/${applianceId}/maintenance`, [])
  const categories = useResource<MaintenanceCategory[]>("/api/maintenance-categories", [])
  const dashboard = useResource<DashboardResponse>("/api/dashboard", emptyDashboard)
  const { tx } = useI18n()
  const { confirmDestructive } = useWebPrefs()
  const [deleteError, setDeleteError] = useState("")
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    if (!confirmDestructive(tx("Delete this appliance? Related maintenance items or incidents will block the delete."))) {
      return
    }
    setDeleting(true)
    setDeleteError("")
    try {
      await requestJSON<void>(`/api/appliances/${applianceId}`, { method: "DELETE" })
      navigate("/appliances")
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : "unknown error")
    } finally {
      setDeleting(false)
    }
  }

  return (
    <main className="view">
      <PageHeader title="Appliance detail" note="Inspect and manage one tracked appliance from the browser." />
      <div className="page-actions">
        <Link className="button-secondary" to="/appliances">{tx("Back to appliances")}</Link>
        <Link className="button-primary" to={`/appliances/${applianceId}/edit`}>{tx("Edit")}</Link>
        <button className="button-danger" type="button" onClick={handleDelete} disabled={deleting}>
          {deleting ? tx("Deleting...") : tx("Delete")}
        </button>
      </div>
      {deleteError ? <InlineError message={deleteError} /> : null}
      <StateGate loading={appliance.loading || maintenance.loading || categories.loading} error={appliance.error || maintenance.error || categories.error} empty={!appliance.data.id}>
        <section className="detail-grid">
          <Panel title={appliance.data.name} note={appliance.data.location || "Appliance"}>
            <DetailList
              rows={[
                ["Brand", appliance.data.brand || "-"],
                ["Model", appliance.data.model_number || "-"],
                ["Serial", appliance.data.serial_number || "-"],
                ["Purchased", formatDate(appliance.data.purchase_date) || "-"],
                ["Warranty", formatDate(appliance.data.warranty_expiry) || "-"],
                ["Cost", formatMoney(appliance.data.cost_cents, dashboard.data.currency_code) || "-"],
              ]}
            />
          </Panel>
          <Panel title="Notes" note="Context and service notes shared with the TUI.">
            <p className="body-copy">{appliance.data.notes || tx("No notes yet.")}</p>
          </Panel>
          <Panel title="Related maintenance" note={maintenance.data.length === 1 ? `${maintenance.data.length} ${tx("item")}` : `${maintenance.data.length} ${tx("items")}`} actions={<Link className="button-link" to="/maintenance/new">{tx("New maintenance item")}</Link>}>
            {maintenance.data.length === 0 ? (
              <EmptyRecord message="No maintenance items linked to this appliance yet." />
            ) : (
              maintenance.data.map((item) => (
                <RecordCard
                  key={item.id}
                  title={item.name}
                  badge={item.season ? statusBadge(item.season) : undefined}
                  subtitle={maintenanceCategoryName(item.category_id, categories.data)}
                  meta={joinMeta([
                    item.interval_months ? `${item.interval_months} ${tx("month interval")}` : tx("No interval"),
                    item.due_date ? formatDate(item.due_date) : tx("No due date"),
                    formatMoney(item.cost_cents, dashboard.data.currency_code),
                  ])}
                  to={`/maintenance/${item.id}`}
                />
              ))
            )}
          </Panel>
        </section>
      </StateGate>
    </main>
  )
}

function ApplianceCreatePage() {
  return <ApplianceFormPage mode="create" />
}

function ApplianceEditPage() {
  return <ApplianceFormPage mode="edit" />
}

function ApplianceFormPage({ mode }: { mode: "create" | "edit" }) {
  const { applianceId = "" } = useParams()
  const navigate = useNavigate()
  const appliance = mode === "edit" ? useResource<Appliance>(`/api/appliances/${applianceId}`, emptyAppliance) : null
  const [draft, setDraft] = useState<ApplianceDraft>(emptyApplianceDraft())
  const [submitError, setSubmitError] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const { tx } = useI18n()

  useEffect(() => {
    if (mode === "edit" && appliance?.data.id) {
      setDraft(applianceToDraft(appliance.data))
    }
  }, [mode, appliance?.data.id, appliance?.data.updated_at])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setSubmitError("")
    try {
      const payload = appliancePayload(draft)
      if (mode === "create") {
        const created = await requestJSON<Appliance>("/api/appliances", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
        navigate(`/appliances/${created.id}`)
      } else {
        const updated = await requestJSON<Appliance>(`/api/appliances/${applianceId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
        navigate(`/appliances/${updated.id}`)
      }
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "unknown error")
    } finally {
      setSubmitting(false)
    }
  }

  const loading = mode === "edit" && Boolean(appliance?.loading)
  const error = mode === "edit" ? appliance?.error ?? "" : ""

  return (
    <main className="view">
      <PageHeader title={mode === "create" ? "New appliance" : "Edit appliance"} note="Track the equipment that maintenance and incidents attach to." />
      <div className="page-actions">
        <Link className="button-secondary" to={mode === "create" ? "/appliances" : `/appliances/${applianceId}`}>
          {tx("Cancel")}
        </Link>
      </div>
      <StateGate loading={loading} error={error} empty={false}>
        <Panel title={mode === "create" ? "Create appliance" : "Update appliance"} note="Core inventory fields map directly to the existing Go model.">
          {submitError ? <InlineError message={submitError} /> : null}
          <ApplianceForm draft={draft} disabled={submitting} onChange={setDraft} onSubmit={handleSubmit} submitLabel={mode === "create" ? tx("Create appliance") : tx("Save changes")} />
        </Panel>
      </StateGate>
    </main>
  )
}

function MaintenancePage() {
  const items = useResource<MaintenanceItem[]>("/api/maintenance", [])
  const categories = useResource<MaintenanceCategory[]>("/api/maintenance-categories", [])
  const appliances = useResource<Appliance[]>("/api/appliances", [])
  const dashboard = useResource<DashboardResponse>("/api/dashboard", emptyDashboard)
  const { tx } = useI18n()

  return (
    <main className="view">
      <PageHeader title="Maintenance" note="Recurring work, seasonal reminders, and tracked service cadence." />
      <div className="page-actions">
        <Link className="button-primary" to="/maintenance/new">{tx("New maintenance item")}</Link>
      </div>
      <StateGate loading={items.loading || categories.loading || appliances.loading} error={items.error || categories.error || appliances.error} empty={items.data.length === 0}>
        <section className="list-grid">
          {items.data.map((item) => (
            <RecordCard
              key={item.id}
              title={item.name}
              badge={item.season ? statusBadge(item.season) : undefined}
              subtitle={maintenanceCategoryName(item.category_id, categories.data)}
              meta={joinMeta([
                applianceName(item.appliance_id, appliances.data),
                item.interval_months ? `${item.interval_months} ${tx("month interval")}` : tx("No interval"),
                item.due_date ? formatDate(item.due_date) : tx("No due date"),
                formatMoney(item.cost_cents, dashboard.data.currency_code),
              ])}
              to={`/maintenance/${item.id}`}
            />
          ))}
        </section>
      </StateGate>
    </main>
  )
}

function MaintenanceDetailPage() {
  const { maintenanceId = "" } = useParams()
  const navigate = useNavigate()
  const item = useResource<MaintenanceItem>(`/api/maintenance/${maintenanceId}`, emptyMaintenance)
  const serviceLogs = useResource<ServiceLogEntry[]>(`/api/maintenance/${maintenanceId}/service-logs`, [])
  const vendors = useResource<Vendor[]>("/api/vendors", [])
  const categories = useResource<MaintenanceCategory[]>("/api/maintenance-categories", [])
  const appliances = useResource<Appliance[]>("/api/appliances", [])
  const dashboard = useResource<DashboardResponse>("/api/dashboard", emptyDashboard)
  const { tx } = useI18n()
  const { confirmDestructive } = useWebPrefs()
  const [deleteError, setDeleteError] = useState("")
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    if (!confirmDestructive(tx("Delete this maintenance item? Existing service logs will block the delete."))) {
      return
    }
    setDeleting(true)
    setDeleteError("")
    try {
      await requestJSON<void>(`/api/maintenance/${maintenanceId}`, { method: "DELETE" })
      navigate("/maintenance")
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : "unknown error")
    } finally {
      setDeleting(false)
    }
  }

  return (
    <main className="view">
      <PageHeader title="Maintenance detail" note="Inspect and manage one maintenance item from the browser." />
      <div className="page-actions">
        <Link className="button-secondary" to="/maintenance">{tx("Back to maintenance")}</Link>
        <Link className="button-primary" to={`/maintenance/${maintenanceId}/edit`}>{tx("Edit")}</Link>
        <button className="button-danger" type="button" onClick={handleDelete} disabled={deleting}>
          {deleting ? tx("Deleting...") : tx("Delete")}
        </button>
      </div>
      {deleteError ? <InlineError message={deleteError} /> : null}
      <StateGate
        loading={item.loading || categories.loading || appliances.loading || serviceLogs.loading || vendors.loading}
        error={item.error || categories.error || appliances.error || serviceLogs.error || vendors.error}
        empty={!item.data.id}
      >
        <section className="detail-grid">
          <Panel title={item.data.name} note={maintenanceCategoryName(item.data.category_id, categories.data)}>
            <DetailList
              rows={[
                ["Category", maintenanceCategoryName(item.data.category_id, categories.data)],
                ["Appliance", applianceName(item.data.appliance_id, appliances.data) || "-"],
                ["Season", item.data.season || "-"],
                ["Last serviced", formatDate(item.data.last_serviced_at) || "-"],
                ["Interval", item.data.interval_months ? `${item.data.interval_months} months` : "-"],
                ["Due", formatDate(item.data.due_date) || "-"],
                ["Cost", formatMoney(item.data.cost_cents, dashboard.data.currency_code) || "-"],
              ]}
            />
          </Panel>
          <Panel title="Notes" note="Service instructions and context shared with the TUI.">
            <p className="body-copy">{item.data.notes || tx("No notes yet.")}</p>
          </Panel>
          <Panel
            title="Service history"
            note={serviceLogs.data.length === 1 ? `${serviceLogs.data.length} ${tx("entry")}` : `${serviceLogs.data.length} ${tx("entries")}`}
            actions={<Link className="button-link" to={`/service-logs/new?maintenanceId=${maintenanceId}`}>{tx("New log")}</Link>}
          >
            {serviceLogs.data.length === 0 ? (
              <EmptyRecord message="No service logs recorded for this maintenance item yet." />
            ) : (
              serviceLogs.data.map((entry) => (
                <RecordCard
                  key={entry.id}
                  title={formatDate(entry.serviced_at) || tx("Service entry")}
                  subtitle={vendorName(entry.vendor_id, vendors.data) || tx("No vendor")}
                  meta={joinMeta([
                    formatMoney(entry.cost_cents, dashboard.data.currency_code),
                    entry.notes,
                  ])}
                  to={`/service-logs/${entry.id}`}
                />
              ))
            )}
          </Panel>
        </section>
      </StateGate>
    </main>
  )
}

function MaintenanceCreatePage() {
  return <MaintenanceFormPage mode="create" />
}

function MaintenanceEditPage() {
  return <MaintenanceFormPage mode="edit" />
}

function MaintenanceFormPage({ mode }: { mode: "create" | "edit" }) {
  const { maintenanceId = "" } = useParams()
  const navigate = useNavigate()
  const item = mode === "edit" ? useResource<MaintenanceItem>(`/api/maintenance/${maintenanceId}`, emptyMaintenance) : null
  const categories = useResource<MaintenanceCategory[]>("/api/maintenance-categories", [])
  const appliances = useResource<Appliance[]>("/api/appliances", [])
  const [draft, setDraft] = useState<MaintenanceDraft>(emptyMaintenanceDraft())
  const [submitError, setSubmitError] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const { tx } = useI18n()

  useEffect(() => {
    if (mode === "edit" && item?.data.id) {
      setDraft(maintenanceToDraft(item.data))
    }
  }, [mode, item?.data.id, item?.data.updated_at])

  useEffect(() => {
    if (mode === "create") {
      setDraft((current) => ({
        ...current,
        categoryID: current.categoryID || categories.data[0]?.id || "",
      }))
    }
  }, [mode, categories.data])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setSubmitError("")
    try {
      const payload = maintenancePayload(draft)
      if (mode === "create") {
        const created = await requestJSON<MaintenanceItem>("/api/maintenance", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
        navigate(`/maintenance/${created.id}`)
      } else {
        const updated = await requestJSON<MaintenanceItem>(`/api/maintenance/${maintenanceId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
        navigate(`/maintenance/${updated.id}`)
      }
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "unknown error")
    } finally {
      setSubmitting(false)
    }
  }

  const loading = categories.loading || appliances.loading || (mode === "edit" && Boolean(item?.loading))
  const error = categories.error || appliances.error || (mode === "edit" ? item?.error ?? "" : "")

  return (
    <main className="view">
      <PageHeader title={mode === "create" ? "New maintenance item" : "Edit maintenance item"} note="Manage recurring work and due dates from the browser." />
      <div className="page-actions">
        <Link className="button-secondary" to={mode === "create" ? "/maintenance" : `/maintenance/${maintenanceId}`}>
          {tx("Cancel")}
        </Link>
      </div>
      <StateGate loading={loading} error={error} empty={false}>
        <Panel title={mode === "create" ? "Create maintenance item" : "Update maintenance item"} note="The browser form writes directly to the shared Go data model.">
          {submitError ? <InlineError message={submitError} /> : null}
          <MaintenanceForm draft={draft} disabled={submitting} categories={categories.data} appliances={appliances.data} onChange={setDraft} onSubmit={handleSubmit} submitLabel={mode === "create" ? tx("Create maintenance item") : tx("Save changes")} />
        </Panel>
      </StateGate>
    </main>
  )
}

function ServiceLogsPage() {
  const serviceLogs = useResource<ServiceLogEntry[]>("/api/service-logs", [])
  const maintenance = useResource<MaintenanceItem[]>("/api/maintenance", [])
  const vendors = useResource<Vendor[]>("/api/vendors", [])
  const dashboard = useResource<DashboardResponse>("/api/dashboard", emptyDashboard)
  const { tx } = useI18n()

  return (
    <main className="view">
      <PageHeader title="Service logs" note="Recorded service visits, repairs, and completed maintenance work." />
      <div className="page-actions">
        <Link className="button-primary" to="/service-logs/new">{tx("New service log")}</Link>
      </div>
      <StateGate loading={serviceLogs.loading || maintenance.loading || vendors.loading} error={serviceLogs.error || maintenance.error || vendors.error} empty={serviceLogs.data.length === 0}>
        <section className="list-grid">
          {serviceLogs.data.map((entry) => (
            <RecordCard
              key={entry.id}
                  title={formatDate(entry.serviced_at) || tx("Service entry")}
              subtitle={maintenanceName(entry.maintenance_item_id, maintenance.data) || "Unknown maintenance item"}
              meta={joinMeta([
                vendorName(entry.vendor_id, vendors.data),
                formatMoney(entry.cost_cents, dashboard.data.currency_code),
                entry.notes,
              ])}
              to={`/service-logs/${entry.id}`}
            />
          ))}
        </section>
      </StateGate>
    </main>
  )
}

function ServiceLogDetailPage() {
  const { serviceLogId = "" } = useParams()
  const navigate = useNavigate()
  const entry = useResource<ServiceLogEntry>(`/api/service-logs/${serviceLogId}`, emptyServiceLog)
  const maintenance = useResource<MaintenanceItem[]>("/api/maintenance", [])
  const vendors = useResource<Vendor[]>("/api/vendors", [])
  const dashboard = useResource<DashboardResponse>("/api/dashboard", emptyDashboard)
  const { tx } = useI18n()
  const { confirmDestructive } = useWebPrefs()
  const [deleteError, setDeleteError] = useState("")
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    if (!confirmDestructive(tx("Delete this service log? This is a soft-delete in the shared SQLite database."))) {
      return
    }
    setDeleting(true)
    setDeleteError("")
    try {
      await requestJSON<void>(`/api/service-logs/${serviceLogId}`, { method: "DELETE" })
      navigate("/service-logs")
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : "unknown error")
    } finally {
      setDeleting(false)
    }
  }

  return (
    <main className="view">
      <PageHeader title="Service log detail" note="Inspect and manage one recorded service visit." />
      <div className="page-actions">
        <Link className="button-secondary" to="/service-logs">{tx("Back to service logs")}</Link>
        {entityPath("maintenance", entry.data.maintenance_item_id) ? (
          <Link className="button-link" to={entityPath("maintenance", entry.data.maintenance_item_id)!}>{tx("Open maintenance")}</Link>
        ) : null}
        {entityPath("vendor", entry.data.vendor_id) ? (
          <Link className="button-link" to={entityPath("vendor", entry.data.vendor_id)!}>{tx("Open vendor")}</Link>
        ) : null}
        <Link className="button-primary" to={`/service-logs/${serviceLogId}/edit`}>{tx("Edit")}</Link>
        <button className="button-danger" type="button" onClick={handleDelete} disabled={deleting}>
          {deleting ? tx("Deleting...") : tx("Delete")}
        </button>
      </div>
      {deleteError ? <InlineError message={deleteError} /> : null}
      <StateGate loading={entry.loading || maintenance.loading || vendors.loading} error={entry.error || maintenance.error || vendors.error} empty={!entry.data.id}>
        <section className="detail-grid">
          <Panel title={formatDate(entry.data.serviced_at) || tx("Service entry")} note={maintenanceName(entry.data.maintenance_item_id, maintenance.data) || tx("Service log")}>
            <DetailList
              rows={[
                ["Maintenance", maintenanceName(entry.data.maintenance_item_id, maintenance.data) || "-"],
                ["Vendor", vendorName(entry.data.vendor_id, vendors.data) || "-"],
                ["Serviced", formatDate(entry.data.serviced_at) || "-"],
                ["Cost", formatMoney(entry.data.cost_cents, dashboard.data.currency_code) || "-"],
              ]}
            />
          </Panel>
          <Panel title="Notes" note="Free-form notes for what happened during the visit.">
            <p className="body-copy">{entry.data.notes || tx("No notes yet.")}</p>
          </Panel>
        </section>
      </StateGate>
    </main>
  )
}

function ServiceLogCreatePage() {
  return <ServiceLogFormPage mode="create" />
}

function ServiceLogEditPage() {
  return <ServiceLogFormPage mode="edit" />
}

function ServiceLogFormPage({ mode }: { mode: "create" | "edit" }) {
  const { serviceLogId = "" } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const entry = mode === "edit" ? useResource<ServiceLogEntry>(`/api/service-logs/${serviceLogId}`, emptyServiceLog) : null
  const maintenance = useResource<MaintenanceItem[]>("/api/maintenance", [])
  const vendors = useResource<Vendor[]>("/api/vendors", [])
  const [draft, setDraft] = useState<ServiceLogDraft>(emptyServiceLogDraft())
  const [submitError, setSubmitError] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const { tx } = useI18n()

  useEffect(() => {
    if (mode === "edit" && entry?.data.id) {
      setDraft(serviceLogToDraft(entry.data))
    }
  }, [mode, entry?.data.id, entry?.data.updated_at])

  useEffect(() => {
    if (mode === "create") {
      const requestedMaintenanceID = searchParams.get("maintenanceId") ?? ""
      setDraft((current) => ({
        ...current,
        maintenanceItemID: current.maintenanceItemID || requestedMaintenanceID || maintenance.data[0]?.id || "",
      }))
    }
  }, [mode, maintenance.data, searchParams])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setSubmitError("")
    try {
      const payload = serviceLogPayload(draft)
      if (mode === "create") {
        const created = await requestJSON<ServiceLogEntry>(`/api/maintenance/${draft.maintenanceItemID}/service-logs`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
        navigate(`/service-logs/${created.id}`)
      } else {
        const updated = await requestJSON<ServiceLogEntry>(`/api/service-logs/${serviceLogId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
        navigate(`/service-logs/${updated.id}`)
      }
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "unknown error")
    } finally {
      setSubmitting(false)
    }
  }

  const loading = maintenance.loading || vendors.loading || (mode === "edit" && Boolean(entry?.loading))
  const error = maintenance.error || vendors.error || (mode === "edit" ? entry?.error ?? "" : "")

  return (
    <main className="view">
      <PageHeader title={mode === "create" ? "New service log" : "Edit service log"} note="Capture actual completed service work tied to a maintenance item." />
      <div className="page-actions">
        <Link className="button-secondary" to={mode === "create" ? "/service-logs" : `/service-logs/${serviceLogId}`}>
          {tx("Cancel")}
        </Link>
      </div>
      <StateGate loading={loading} error={error} empty={false}>
        <Panel title={mode === "create" ? "Create service log" : "Update service log"} note="Writes reuse the same Go data-layer behavior that updates maintenance history.">
          {submitError ? <InlineError message={submitError} /> : null}
          <ServiceLogForm draft={draft} disabled={submitting} maintenanceItems={maintenance.data} vendors={vendors.data} onChange={setDraft} onSubmit={handleSubmit} submitLabel={mode === "create" ? tx("Create service log") : tx("Save changes")} />
        </Panel>
      </StateGate>
    </main>
  )
}

function IncidentsPage() {
  const incidents = useResource<Incident[]>("/api/incidents", [])
  const vendors = useResource<Vendor[]>("/api/vendors", [])
  const appliances = useResource<Appliance[]>("/api/appliances", [])
  const dashboard = useResource<DashboardResponse>("/api/dashboard", emptyDashboard)
  const { tx } = useI18n()

  return (
    <main className="view">
      <PageHeader title="Incidents" note="Problems, failures, and follow-ups that still need attention." />
      <div className="page-actions">
        <Link className="button-primary" to="/incidents/new">{tx("New incident")}</Link>
      </div>
      <StateGate loading={incidents.loading || vendors.loading || appliances.loading} error={incidents.error || vendors.error || appliances.error} empty={incidents.data.length === 0}>
        <section className="list-grid">
          {incidents.data.map((incident) => (
            <RecordCard
              key={incident.id}
              title={incident.title}
              badge={statusBadge(incident.status || incident.severity)}
                  subtitle={incident.description || incident.location || tx("No incident detail")}
              meta={joinMeta([
                incident.severity ? tx(incident.severity.replaceAll("_", " ")) : "",
                formatDate(incident.date_noticed),
                applianceName(incident.appliance_id, appliances.data),
                vendorName(incident.vendor_id, vendors.data),
                formatMoney(incident.cost_cents, dashboard.data.currency_code),
              ])}
              to={`/incidents/${incident.id}`}
            />
          ))}
        </section>
      </StateGate>
    </main>
  )
}

function IncidentDetailPage() {
  const { incidentId = "" } = useParams()
  const navigate = useNavigate()
  const incident = useResource<Incident>(`/api/incidents/${incidentId}`, emptyIncident)
  const vendors = useResource<Vendor[]>("/api/vendors", [])
  const appliances = useResource<Appliance[]>("/api/appliances", [])
  const dashboard = useResource<DashboardResponse>("/api/dashboard", emptyDashboard)
  const { tx } = useI18n()
  const { confirmDestructive } = useWebPrefs()
  const [deleteError, setDeleteError] = useState("")
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    if (!confirmDestructive(tx("Delete this incident? The current store behavior will mark it resolved as part of the soft-delete."))) {
      return
    }
    setDeleting(true)
    setDeleteError("")
    try {
      await requestJSON<void>(`/api/incidents/${incidentId}`, { method: "DELETE" })
      navigate("/incidents")
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : "unknown error")
    } finally {
      setDeleting(false)
    }
  }

  return (
    <main className="view">
      <PageHeader title="Incident detail" note="Inspect and manage one incident from the browser." />
      <div className="page-actions">
        <Link className="button-secondary" to="/incidents">{tx("Back to incidents")}</Link>
        {entityPath("appliance", incident.data.appliance_id) ? (
          <Link className="button-link" to={entityPath("appliance", incident.data.appliance_id)!}>{tx("Open appliance")}</Link>
        ) : null}
        {entityPath("vendor", incident.data.vendor_id) ? (
          <Link className="button-link" to={entityPath("vendor", incident.data.vendor_id)!}>{tx("Open vendor")}</Link>
        ) : null}
        <Link className="button-primary" to={`/incidents/${incidentId}/edit`}>{tx("Edit")}</Link>
        <button className="button-danger" type="button" onClick={handleDelete} disabled={deleting}>
          {deleting ? tx("Deleting...") : tx("Delete")}
        </button>
      </div>
      {deleteError ? <InlineError message={deleteError} /> : null}
      <StateGate loading={incident.loading || vendors.loading || appliances.loading} error={incident.error || vendors.error || appliances.error} empty={!incident.data.id}>
        <section className="detail-grid">
          <Panel title={incident.data.title} note={incident.data.location || "Incident"}>
            <DetailList
              rows={[
                ["Status", incident.data.status],
                ["Severity", tx(incident.data.severity)],
                ["Noticed", formatDate(incident.data.date_noticed) || "-"],
                ["Resolved", formatDate(incident.data.date_resolved) || "-"],
                ["Appliance", applianceName(incident.data.appliance_id, appliances.data) || "-"],
                ["Vendor", vendorName(incident.data.vendor_id, vendors.data) || "-"],
                ["Cost", formatMoney(incident.data.cost_cents, dashboard.data.currency_code) || "-"],
              ]}
            />
          </Panel>
          <Panel title="Description" note="What happened and where it stands.">
            <p className="body-copy">{incident.data.description || tx("No description yet.")}</p>
          </Panel>
          <Panel title="Notes" note="Additional context shared with the TUI.">
            <p className="body-copy">{incident.data.notes || tx("No notes yet.")}</p>
          </Panel>
        </section>
      </StateGate>
    </main>
  )
}

function IncidentCreatePage() {
  return <IncidentFormPage mode="create" />
}

function IncidentEditPage() {
  return <IncidentFormPage mode="edit" />
}

function IncidentFormPage({ mode }: { mode: "create" | "edit" }) {
  const { incidentId = "" } = useParams()
  const navigate = useNavigate()
  const incident = mode === "edit" ? useResource<Incident>(`/api/incidents/${incidentId}`, emptyIncident) : null
  const vendors = useResource<Vendor[]>("/api/vendors", [])
  const appliances = useResource<Appliance[]>("/api/appliances", [])
  const [draft, setDraft] = useState<IncidentDraft>(emptyIncidentDraft())
  const [submitError, setSubmitError] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const { tx } = useI18n()

  useEffect(() => {
    if (mode === "edit" && incident?.data.id) {
      setDraft(incidentToDraft(incident.data))
    }
  }, [mode, incident?.data.id, incident?.data.updated_at])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setSubmitError("")
    try {
      const payload = incidentPayload(draft)
      if (mode === "create") {
        const created = await requestJSON<Incident>("/api/incidents", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
        navigate(`/incidents/${created.id}`)
      } else {
        const updated = await requestJSON<Incident>(`/api/incidents/${incidentId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
        navigate(`/incidents/${updated.id}`)
      }
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "unknown error")
    } finally {
      setSubmitting(false)
    }
  }

  const loading = vendors.loading || appliances.loading || (mode === "edit" && Boolean(incident?.loading))
  const error = vendors.error || appliances.error || (mode === "edit" ? incident?.error ?? "" : "")

  return (
    <main className="view">
      <PageHeader title={mode === "create" ? "New incident" : "Edit incident"} note="Track active problems and repair follow-up from the browser." />
      <div className="page-actions">
        <Link className="button-secondary" to={mode === "create" ? "/incidents" : `/incidents/${incidentId}`}>
          {tx("Cancel")}
        </Link>
      </div>
      <StateGate loading={loading} error={error} empty={false}>
        <Panel title={mode === "create" ? "Create incident" : "Update incident"} note="Incident fields map directly onto the existing Go data model.">
          {submitError ? <InlineError message={submitError} /> : null}
          <IncidentForm draft={draft} disabled={submitting} vendors={vendors.data} appliances={appliances.data} onChange={setDraft} onSubmit={handleSubmit} submitLabel={mode === "create" ? tx("Create incident") : tx("Save changes")} />
        </Panel>
      </StateGate>
    </main>
  )
}

function DocumentsPage() {
  const documents = useResource<Document[]>("/api/documents", [])
  const projects = useResource<Project[]>("/api/projects", [])
  const vendors = useResource<Vendor[]>("/api/vendors", [])
  const quotes = useResource<Quote[]>("/api/quotes", [])
  const appliances = useResource<Appliance[]>("/api/appliances", [])
  const maintenance = useResource<MaintenanceItem[]>("/api/maintenance", [])
  const incidents = useResource<Incident[]>("/api/incidents", [])
  const { tx } = useI18n()

  return (
    <main className="view">
      <PageHeader title="Documents" note="Invoices, manuals, contracts, images, and extracted notes." />
      <div className="page-actions">
        <Link className="button-primary" to="/documents/new">{tx("Upload document")}</Link>
      </div>
      <StateGate
        loading={documents.loading || projects.loading || vendors.loading || quotes.loading || appliances.loading || maintenance.loading || incidents.loading}
        error={documents.error || projects.error || vendors.error || quotes.error || appliances.error || maintenance.error || incidents.error}
        empty={documents.data.length === 0}
      >
        <section className="list-grid">
          {documents.data.map((document) => (
            <RecordCard
              key={document.id}
              title={document.title || document.file_name}
              badge={document.entity_kind ? statusBadge(document.entity_kind) : undefined}
              subtitle={document.file_name}
              meta={joinMeta([
                formatBytes(document.size_bytes),
                document.mime_type,
                linkedEntityLabel(document.entity_kind, document.entity_id, {
                  projects: projects.data,
                  vendors: vendors.data,
                  quotes: quotes.data,
                  appliances: appliances.data,
                  maintenance: maintenance.data,
                  incidents: incidents.data,
                }),
                document.notes,
              ])}
              to={`/documents/${document.id}`}
            />
          ))}
        </section>
      </StateGate>
    </main>
  )
}

function TrashPage() {
  const trash = useResource<TrashItem[]>("/api/trash", [])
  const { tx } = useI18n()
  const [restoringID, setRestoringID] = useState("")
  const [restoreError, setRestoreError] = useState("")

  async function handleRestore(item: TrashItem) {
    setRestoringID(item.target_id)
    setRestoreError("")
    try {
      await requestJSON<void>(`/api/trash/${item.entity}/${item.target_id}/restore`, { method: "POST" })
      trash.reload()
    } catch (error) {
      setRestoreError(error instanceof Error ? error.message : "unknown error")
    } finally {
      setRestoringID("")
    }
  }

  return (
    <main className="view">
      <PageHeader title="Trash" note="Restore soft-deleted records from the browser without leaving the web UI." />
      {restoreError ? <InlineError message={restoreError} /> : null}
      <StateGate loading={trash.loading} error={trash.error} empty={trash.data.length === 0}>
        <section className="list-grid">
          {trash.data.map((item) => (
            <article key={`${item.entity}-${item.target_id}`} className="record-card">
              <div className="record-top">
                <strong>{item.label}</strong>
                <span className="status-badge status-resolved">{item.entity_label}</span>
              </div>
              <p className="record-subtitle">{`${tx("Deleted")} ${formatDate(item.deleted_at) || item.deleted_at}`}</p>
              <p className="record-meta">{`ID ${item.target_id}`}</p>
              <div className="record-actions">
                <button className="button-primary" type="button" onClick={() => handleRestore(item)} disabled={restoringID === item.target_id}>
                  {restoringID === item.target_id ? tx("Restoring...") : tx("Restore")}
                </button>
              </div>
            </article>
          ))}
        </section>
      </StateGate>
    </main>
  )
}

function DocumentDetailPage() {
  const { documentId = "" } = useParams()
  const navigate = useNavigate()
  const document = useResource<Document>(`/api/documents/${documentId}`, emptyDocument())
  const projects = useResource<Project[]>("/api/projects", [])
  const vendors = useResource<Vendor[]>("/api/vendors", [])
  const quotes = useResource<Quote[]>("/api/quotes", [])
  const appliances = useResource<Appliance[]>("/api/appliances", [])
  const maintenance = useResource<MaintenanceItem[]>("/api/maintenance", [])
  const incidents = useResource<Incident[]>("/api/incidents", [])
  const { tx } = useI18n()
  const { confirmDestructive } = useWebPrefs()
  const [deleteError, setDeleteError] = useState("")
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    if (!confirmDestructive(tx("Delete this document? This is a soft-delete in the shared SQLite database."))) {
      return
    }
    setDeleting(true)
    setDeleteError("")
    try {
      await requestJSON<void>(`/api/documents/${documentId}`, { method: "DELETE" })
      navigate("/documents")
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : "unknown error")
    } finally {
      setDeleting(false)
    }
  }

  return (
    <main className="view">
      <PageHeader title="Document detail" note="Inspect metadata and download the original file." />
      <div className="page-actions">
        <Link className="button-secondary" to="/documents">{tx("Back to documents")}</Link>
        <a className="button-link" href={`/api/documents/${documentId}/download`}>{tx("Download file")}</a>
        {entityPath(document.data.entity_kind, document.data.entity_id) ? (
          <Link className="button-link" to={entityPath(document.data.entity_kind, document.data.entity_id)!}>{tx("Open linked record")}</Link>
        ) : null}
        <Link className="button-primary" to={`/documents/${documentId}/edit`}>{tx("Edit metadata")}</Link>
        <button className="button-danger" type="button" onClick={handleDelete} disabled={deleting}>
          {deleting ? tx("Deleting...") : tx("Delete")}
        </button>
      </div>
      {deleteError ? <InlineError message={deleteError} /> : null}
      <StateGate
        loading={document.loading || projects.loading || vendors.loading || quotes.loading || appliances.loading || maintenance.loading || incidents.loading}
        error={document.error || projects.error || vendors.error || quotes.error || appliances.error || maintenance.error || incidents.error}
        empty={!document.data.id}
      >
        <section className="detail-grid">
          <Panel title={document.data.title || document.data.file_name} note={document.data.file_name}>
            <DetailList
              rows={[
                ["MIME", document.data.mime_type || "-"],
                ["Size", formatBytes(document.data.size_bytes)],
                ["Linked to", linkedEntityLabel(document.data.entity_kind, document.data.entity_id, {
                  projects: projects.data,
                  vendors: vendors.data,
                  quotes: quotes.data,
                  appliances: appliances.data,
                  maintenance: maintenance.data,
                  incidents: incidents.data,
                }) || "-"],
                ["Created", formatDate(document.data.created_at) || "-"],
                ["Updated", formatDate(document.data.updated_at) || "-"],
              ]}
            />
          </Panel>
          <Panel title="Notes" note="Document metadata shared with the TUI.">
            <p className="body-copy">{document.data.notes || tx("No notes yet.")}</p>
          </Panel>
        </section>
      </StateGate>
    </main>
  )
}

function DocumentCreatePage() {
  return <DocumentFormPage mode="create" />
}

function DocumentEditPage() {
  return <DocumentFormPage mode="edit" />
}

function DocumentFormPage({ mode }: { mode: "create" | "edit" }) {
  const { documentId = "" } = useParams()
  const navigate = useNavigate()
  const document = mode === "edit" ? useResource<Document>(`/api/documents/${documentId}`, emptyDocument()) : null
  const projects = useResource<Project[]>("/api/projects", [])
  const vendors = useResource<Vendor[]>("/api/vendors", [])
  const quotes = useResource<Quote[]>("/api/quotes", [])
  const appliances = useResource<Appliance[]>("/api/appliances", [])
  const maintenance = useResource<MaintenanceItem[]>("/api/maintenance", [])
  const incidents = useResource<Incident[]>("/api/incidents", [])
  const [draft, setDraft] = useState<DocumentDraft>(emptyDocumentDraft())
  const [file, setFile] = useState<File | null>(null)
  const [submitError, setSubmitError] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const { tx } = useI18n()

  useEffect(() => {
    if (mode === "edit" && document?.data.id) {
      setDraft(documentToDraft(document.data))
    }
  }, [mode, document?.data.id, document?.data.updated_at])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setSubmitError("")
    try {
      if (mode === "create") {
        if (!file) {
          throw new Error(tx("select a file to upload"))
        }
        const formData = new FormData()
        formData.set("file", file)
        if (draft.title.trim()) {
          formData.set("title", draft.title.trim())
        }
        if (draft.entityKind && draft.entityID) {
          formData.set("entityKind", draft.entityKind)
          formData.set("entityId", draft.entityID)
        }
        if (draft.notes.trim()) {
          formData.set("notes", draft.notes.trim())
        }
        const created = await requestJSON<Document>("/api/documents", {
          method: "POST",
          body: formData,
        })
        navigate(`/documents/${created.id}`)
      } else {
        const updated = await requestJSON<Document>(`/api/documents/${documentId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(documentPayload(draft)),
        })
        navigate(`/documents/${updated.id}`)
      }
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "unknown error")
    } finally {
      setSubmitting(false)
    }
  }

  const loading = projects.loading || vendors.loading || quotes.loading || appliances.loading || maintenance.loading || incidents.loading || (mode === "edit" && Boolean(document?.loading))
  const error = projects.error || vendors.error || quotes.error || appliances.error || maintenance.error || incidents.error || (mode === "edit" ? document?.error ?? "" : "")

  return (
    <main className="view">
      <PageHeader title={mode === "create" ? "Upload document" : "Edit document metadata"} note="Store the file once, then keep the metadata aligned with the rest of the house records." />
      <div className="page-actions">
        <Link className="button-secondary" to={mode === "create" ? "/documents" : `/documents/${documentId}`}>
          {tx("Cancel")}
        </Link>
      </div>
      <StateGate loading={loading} error={error} empty={false}>
        <Panel title={mode === "create" ? "Upload document" : "Update document metadata"} note="Upload uses multipart form-data; metadata edits keep the original file intact.">
          {submitError ? <InlineError message={submitError} /> : null}
          <DocumentForm
            mode={mode}
            draft={draft}
            file={file}
            disabled={submitting}
            entities={{
              projects: projects.data,
              vendors: vendors.data,
              quotes: quotes.data,
              appliances: appliances.data,
              maintenance: maintenance.data,
              incidents: incidents.data,
            }}
            onChange={setDraft}
            onFileChange={setFile}
            onSubmit={handleSubmit}
            submitLabel={mode === "create" ? tx("Upload document") : tx("Save metadata")}
          />
        </Panel>
      </StateGate>
    </main>
  )
}

type ResourcePageProps<T> = {
  title: string
  note: string
  path: string
  empty: T[]
  renderCard: (item: T, currencyCode: string) => ReactNode
}

function ResourcePage<T>({ title, note, path, empty, renderCard }: ResourcePageProps<T>) {
  const resource = useResource<T[]>(path, empty)
  const dashboard = useResource<DashboardResponse>("/api/dashboard", emptyDashboard)

  return (
    <main className="view">
      <PageHeader title={title} note={note} />
      <StateGate loading={resource.loading} error={resource.error} empty={resource.data.length === 0}>
        <section className="list-grid">
          {resource.data.map((item, index) => (
            <article key={index} className="list-entry">
              {renderCard(item, dashboard.data.currency_code)}
            </article>
          ))}
        </section>
      </StateGate>
    </main>
  )
}

function HouseCard({ house }: { house: HouseProfile | null }) {
  const { settings } = useAppSettings()

  if (!house || !house.nickname) {
    return <EmptyRecord message="No house profile yet. Create it here or in the TUI; both surfaces share the same data." />
  }

  return (
    <div className="house-card">
      <p className="house-address">{joinMeta([house.address_line1, house.address_line2, house.postal_code])}</p>
      <div className="metric-grid">
        <Metric label="Built" value={valueOrDash(house.year_built)} />
        <Metric label="Footprint" value={formatAreaDisplay(house.square_feet, settings.shared.unit_system)} />
        <Metric label="Bedrooms" value={valueOrDash(house.bedrooms)} />
        <Metric label="Bathrooms" value={valueOrDash(house.bathrooms)} />
      </div>
    </div>
  )
}

function HouseForm({
  draft,
  disabled,
  onChange,
  onSubmit,
  onCancel,
  showActions,
}: {
  draft: HouseDraft
  disabled: boolean
  onChange: (next: HouseDraft) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  onCancel?: () => void
  showActions: boolean
}) {
  const { tx } = useI18n()

  function handleFieldChange(field: keyof HouseDraft) {
    return (event: ChangeEvent<HTMLInputElement>) => {
      onChange({ ...draft, [field]: event.target.value })
    }
  }

  return (
    <form className="form-grid" onSubmit={onSubmit}>
      <FormField label="Nickname">
        <input value={draft.nickname} onChange={handleFieldChange("nickname")} disabled={disabled} />
      </FormField>
      <FormField label="Address line 1">
        <input value={draft.addressLine1} onChange={handleFieldChange("addressLine1")} disabled={disabled} />
      </FormField>
      <FormField label="Address line 2">
        <input value={draft.addressLine2} onChange={handleFieldChange("addressLine2")} disabled={disabled} />
      </FormField>
      <FormField label="City">
        <input value={draft.city} onChange={handleFieldChange("city")} disabled={disabled} />
      </FormField>
      <FormField label="State or region">
        <input value={draft.state} onChange={handleFieldChange("state")} disabled={disabled} />
      </FormField>
      <FormField label="Postal code">
        <input value={draft.postalCode} onChange={handleFieldChange("postalCode")} disabled={disabled} />
      </FormField>
      <FormField label="Year built">
        <input type="number" value={draft.yearBuilt} onChange={handleFieldChange("yearBuilt")} disabled={disabled} />
      </FormField>
      <FormField label="Square feet">
        <input type="number" value={draft.squareFeet} onChange={handleFieldChange("squareFeet")} disabled={disabled} />
      </FormField>
      <FormField label="Lot square feet">
        <input type="number" value={draft.lotSquareFeet} onChange={handleFieldChange("lotSquareFeet")} disabled={disabled} />
      </FormField>
      <FormField label="Bedrooms">
        <input type="number" value={draft.bedrooms} onChange={handleFieldChange("bedrooms")} disabled={disabled} />
      </FormField>
      <FormField label="Bathrooms">
        <input type="number" step="0.5" value={draft.bathrooms} onChange={handleFieldChange("bathrooms")} disabled={disabled} />
      </FormField>
      {showActions ? (
        <div className="form-actions">
          <button className="button-primary" type="submit" disabled={disabled}>{tx("Save house profile")}</button>
          {onCancel ? (
            <button className="button-secondary" type="button" onClick={onCancel} disabled={disabled}>
              {tx("Cancel")}
            </button>
          ) : null}
        </div>
      ) : null}
    </form>
  )
}

function ProjectForm({
  draft,
  disabled,
  projectTypes,
  onChange,
  onSubmit,
  submitLabel,
}: {
  draft: ProjectDraft
  disabled: boolean
  projectTypes: ProjectType[]
  onChange: (next: ProjectDraft) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  submitLabel: string
}) {
  const { tx } = useI18n()

  function updateField(field: keyof ProjectDraft) {
    return (event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      onChange({ ...draft, [field]: event.target.value })
    }
  }

  return (
    <form className="form-grid" onSubmit={onSubmit}>
      <FormField label="Title">
        <input value={draft.title} onChange={updateField("title")} disabled={disabled} required />
      </FormField>
      <FormField label="Project type">
        <select value={draft.projectTypeID} onChange={updateField("projectTypeID")} disabled={disabled} required>
          <option value="">{tx("Select a type")}</option>
          {projectTypes.map((projectType) => (
            <option key={projectType.id} value={projectType.id}>{projectTypeName(projectType.id, projectTypes)}</option>
          ))}
        </select>
      </FormField>
      <FormField label="Status">
        <select value={draft.status} onChange={updateField("status")} disabled={disabled}>
          {projectStatusOptions.map((option) => (
            <option key={option.value} value={option.value}>{tx(option.label)}</option>
          ))}
        </select>
      </FormField>
      <FormField label="Start date">
        <input type="date" value={draft.startDate} onChange={updateField("startDate")} disabled={disabled} />
      </FormField>
      <FormField label="End date">
        <input type="date" value={draft.endDate} onChange={updateField("endDate")} disabled={disabled} />
      </FormField>
      <FormField label="Budget">
        <input type="number" step="0.01" value={draft.budget} onChange={updateField("budget")} disabled={disabled} />
      </FormField>
      <FormField label="Actual spend">
        <input type="number" step="0.01" value={draft.actual} onChange={updateField("actual")} disabled={disabled} />
      </FormField>
      <FormField label="Description" fullWidth>
        <textarea value={draft.description} onChange={updateField("description")} disabled={disabled} rows={6} />
      </FormField>
      <div className="form-actions">
        <button className="button-primary" type="submit" disabled={disabled}>{disabled ? tx("Saving...") : submitLabel}</button>
      </div>
    </form>
  )
}

function VendorForm({
  draft,
  disabled,
  onChange,
  onSubmit,
  submitLabel,
}: {
  draft: VendorDraft
  disabled: boolean
  onChange: (next: VendorDraft) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  submitLabel: string
}) {
  const { tx } = useI18n()

  function updateField(field: keyof VendorDraft) {
    return (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      onChange({ ...draft, [field]: event.target.value })
    }
  }

  return (
    <form className="form-grid" onSubmit={onSubmit}>
      <FormField label="Name">
        <input value={draft.name} onChange={updateField("name")} disabled={disabled} required />
      </FormField>
      <FormField label="Contact name">
        <input value={draft.contactName} onChange={updateField("contactName")} disabled={disabled} />
      </FormField>
      <FormField label="Email">
        <input value={draft.email} onChange={updateField("email")} disabled={disabled} />
      </FormField>
      <FormField label="Phone">
        <input value={draft.phone} onChange={updateField("phone")} disabled={disabled} />
      </FormField>
      <FormField label="Website">
        <input value={draft.website} onChange={updateField("website")} disabled={disabled} />
      </FormField>
      <FormField label="Locale">
        <input value={draft.locale} onChange={updateField("locale")} disabled={disabled} />
      </FormField>
      <FormField label="Notes" fullWidth>
        <textarea value={draft.notes} onChange={updateField("notes")} disabled={disabled} rows={5} />
      </FormField>
      <div className="form-actions">
        <button className="button-primary" type="submit" disabled={disabled}>{disabled ? tx("Saving...") : submitLabel}</button>
      </div>
    </form>
  )
}

function QuoteForm({
  draft,
  disabled,
  projects,
  vendors,
  onChange,
  onSubmit,
  submitLabel,
}: {
  draft: QuoteDraft
  disabled: boolean
  projects: Project[]
  vendors: Vendor[]
  onChange: (next: QuoteDraft) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  submitLabel: string
}) {
  const { tx } = useI18n()

  function updateField(field: keyof QuoteDraft) {
    return (event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      onChange({ ...draft, [field]: event.target.value })
    }
  }

  return (
    <form className="form-grid" onSubmit={onSubmit}>
      <FormField label="Project">
        <select value={draft.projectID} onChange={updateField("projectID")} disabled={disabled} required>
          <option value="">{tx("Select a project")}</option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>{project.title}</option>
          ))}
        </select>
      </FormField>
      <FormField label="Vendor">
        <select value={draft.vendorID} onChange={updateField("vendorID")} disabled={disabled} required>
          <option value="">{tx("Select a vendor")}</option>
          {vendors.map((vendor) => (
            <option key={vendor.id} value={vendor.id}>{vendor.name}</option>
          ))}
        </select>
      </FormField>
      <FormField label="Total">
        <input type="number" step="0.01" value={draft.total} onChange={updateField("total")} disabled={disabled} required />
      </FormField>
      <FormField label="Labor">
        <input type="number" step="0.01" value={draft.labor} onChange={updateField("labor")} disabled={disabled} />
      </FormField>
      <FormField label="Materials">
        <input type="number" step="0.01" value={draft.materials} onChange={updateField("materials")} disabled={disabled} />
      </FormField>
      <FormField label="Received date">
        <input type="date" value={draft.receivedDate} onChange={updateField("receivedDate")} disabled={disabled} />
      </FormField>
      <FormField label="Notes" fullWidth>
        <textarea value={draft.notes} onChange={updateField("notes")} disabled={disabled} rows={5} />
      </FormField>
      <div className="form-actions">
        <button className="button-primary" type="submit" disabled={disabled}>{disabled ? tx("Saving...") : submitLabel}</button>
      </div>
    </form>
  )
}

function ApplianceForm({
  draft,
  disabled,
  onChange,
  onSubmit,
  submitLabel,
}: {
  draft: ApplianceDraft
  disabled: boolean
  onChange: (next: ApplianceDraft) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  submitLabel: string
}) {
  const { tx } = useI18n()

  function updateField(field: keyof ApplianceDraft) {
    return (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      onChange({ ...draft, [field]: event.target.value })
    }
  }

  return (
    <form className="form-grid" onSubmit={onSubmit}>
      <FormField label="Name">
        <input value={draft.name} onChange={updateField("name")} disabled={disabled} required />
      </FormField>
      <FormField label="Brand">
        <input value={draft.brand} onChange={updateField("brand")} disabled={disabled} />
      </FormField>
      <FormField label="Model number">
        <input value={draft.modelNumber} onChange={updateField("modelNumber")} disabled={disabled} />
      </FormField>
      <FormField label="Serial number">
        <input value={draft.serialNumber} onChange={updateField("serialNumber")} disabled={disabled} />
      </FormField>
      <FormField label="Purchase date">
        <input type="date" value={draft.purchaseDate} onChange={updateField("purchaseDate")} disabled={disabled} />
      </FormField>
      <FormField label="Warranty expiry">
        <input type="date" value={draft.warrantyExpiry} onChange={updateField("warrantyExpiry")} disabled={disabled} />
      </FormField>
      <FormField label="Location">
        <input value={draft.location} onChange={updateField("location")} disabled={disabled} />
      </FormField>
      <FormField label="Cost">
        <input type="number" step="0.01" value={draft.cost} onChange={updateField("cost")} disabled={disabled} />
      </FormField>
      <FormField label="Notes" fullWidth>
        <textarea value={draft.notes} onChange={updateField("notes")} disabled={disabled} rows={5} />
      </FormField>
      <div className="form-actions">
        <button className="button-primary" type="submit" disabled={disabled}>{disabled ? tx("Saving...") : submitLabel}</button>
      </div>
    </form>
  )
}

function MaintenanceForm({
  draft,
  disabled,
  categories,
  appliances,
  onChange,
  onSubmit,
  submitLabel,
}: {
  draft: MaintenanceDraft
  disabled: boolean
  categories: MaintenanceCategory[]
  appliances: Appliance[]
  onChange: (next: MaintenanceDraft) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  submitLabel: string
}) {
  const { tx } = useI18n()

  function updateField(field: keyof MaintenanceDraft) {
    return (event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      onChange({ ...draft, [field]: event.target.value })
    }
  }

  return (
    <form className="form-grid" onSubmit={onSubmit}>
      <FormField label="Name">
        <input value={draft.name} onChange={updateField("name")} disabled={disabled} required />
      </FormField>
      <FormField label="Category">
        <select value={draft.categoryID} onChange={updateField("categoryID")} disabled={disabled} required>
          <option value="">{tx("Select a category")}</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>{maintenanceCategoryName(category.id, categories)}</option>
          ))}
        </select>
      </FormField>
      <FormField label="Appliance">
        <select value={draft.applianceID} onChange={updateField("applianceID")} disabled={disabled}>
          <option value="">{tx("No appliance")}</option>
          {appliances.map((appliance) => (
            <option key={appliance.id} value={appliance.id}>{appliance.name}</option>
          ))}
        </select>
      </FormField>
      <FormField label="Season">
        <input value={draft.season} onChange={updateField("season")} disabled={disabled} placeholder={tx("spring, summer, fall, winter")} />
      </FormField>
      <FormField label="Last serviced">
        <input type="date" value={draft.lastServicedAt} onChange={updateField("lastServicedAt")} disabled={disabled} />
      </FormField>
      <FormField label="Interval months">
        <input type="number" value={draft.intervalMonths} onChange={updateField("intervalMonths")} disabled={disabled} />
      </FormField>
      <FormField label="Due date">
        <input type="date" value={draft.dueDate} onChange={updateField("dueDate")} disabled={disabled} />
      </FormField>
      <FormField label="Estimated cost">
        <input type="number" step="0.01" value={draft.cost} onChange={updateField("cost")} disabled={disabled} />
      </FormField>
      <FormField label="Notes" fullWidth>
        <textarea value={draft.notes} onChange={updateField("notes")} disabled={disabled} rows={5} />
      </FormField>
      <div className="form-actions">
        <button className="button-primary" type="submit" disabled={disabled}>{disabled ? tx("Saving...") : submitLabel}</button>
      </div>
    </form>
  )
}

function IncidentForm({
  draft,
  disabled,
  vendors,
  appliances,
  onChange,
  onSubmit,
  submitLabel,
}: {
  draft: IncidentDraft
  disabled: boolean
  vendors: Vendor[]
  appliances: Appliance[]
  onChange: (next: IncidentDraft) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  submitLabel: string
}) {
  const { tx } = useI18n()

  function updateField(field: keyof IncidentDraft) {
    return (event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      onChange({ ...draft, [field]: event.target.value })
    }
  }

  return (
    <form className="form-grid" onSubmit={onSubmit}>
      <FormField label="Title">
        <input value={draft.title} onChange={updateField("title")} disabled={disabled} required />
      </FormField>
      <FormField label="Location">
        <input value={draft.location} onChange={updateField("location")} disabled={disabled} />
      </FormField>
      <FormField label="Status">
        <select value={draft.status} onChange={updateField("status")} disabled={disabled}>
          {incidentStatusOptions.map((option) => (
            <option key={option.value} value={option.value}>{tx(option.label)}</option>
          ))}
        </select>
      </FormField>
      <FormField label="Severity">
        <select value={draft.severity} onChange={updateField("severity")} disabled={disabled}>
          {incidentSeverityOptions.map((option) => (
            <option key={option.value} value={option.value}>{tx(option.label)}</option>
          ))}
        </select>
      </FormField>
      <FormField label="Date noticed">
        <input type="date" value={draft.dateNoticed} onChange={updateField("dateNoticed")} disabled={disabled} />
      </FormField>
      <FormField label="Date resolved">
        <input type="date" value={draft.dateResolved} onChange={updateField("dateResolved")} disabled={disabled} />
      </FormField>
      <FormField label="Appliance">
        <select value={draft.applianceID} onChange={updateField("applianceID")} disabled={disabled}>
          <option value="">{tx("No appliance")}</option>
          {appliances.map((appliance) => (
            <option key={appliance.id} value={appliance.id}>{appliance.name}</option>
          ))}
        </select>
      </FormField>
      <FormField label="Vendor">
        <select value={draft.vendorID} onChange={updateField("vendorID")} disabled={disabled}>
          <option value="">{tx("No vendor")}</option>
          {vendors.map((vendor) => (
            <option key={vendor.id} value={vendor.id}>{vendor.name}</option>
          ))}
        </select>
      </FormField>
      <FormField label="Cost">
        <input type="number" step="0.01" value={draft.cost} onChange={updateField("cost")} disabled={disabled} />
      </FormField>
      <FormField label="Description" fullWidth>
        <textarea value={draft.description} onChange={updateField("description")} disabled={disabled} rows={5} />
      </FormField>
      <FormField label="Notes" fullWidth>
        <textarea value={draft.notes} onChange={updateField("notes")} disabled={disabled} rows={4} />
      </FormField>
      <div className="form-actions">
        <button className="button-primary" type="submit" disabled={disabled}>{disabled ? tx("Saving...") : submitLabel}</button>
      </div>
    </form>
  )
}

function ServiceLogForm({
  draft,
  disabled,
  maintenanceItems,
  vendors,
  onChange,
  onSubmit,
  submitLabel,
}: {
  draft: ServiceLogDraft
  disabled: boolean
  maintenanceItems: MaintenanceItem[]
  vendors: Vendor[]
  onChange: (next: ServiceLogDraft) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  submitLabel: string
}) {
  const { tx } = useI18n()

  function updateField(field: keyof ServiceLogDraft) {
    return (event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      onChange({ ...draft, [field]: event.target.value })
    }
  }

  return (
    <form className="form-grid" onSubmit={onSubmit}>
      <FormField label="Maintenance item">
        <select value={draft.maintenanceItemID} onChange={updateField("maintenanceItemID")} disabled={disabled} required>
          <option value="">{tx("Select maintenance item")}</option>
          {maintenanceItems.map((item) => (
            <option key={item.id} value={item.id}>{item.name}</option>
          ))}
        </select>
      </FormField>
      <FormField label="Vendor">
        <select value={draft.vendorID} onChange={updateField("vendorID")} disabled={disabled}>
          <option value="">{tx("No vendor")}</option>
          {vendors.map((vendor) => (
            <option key={vendor.id} value={vendor.id}>{vendor.name}</option>
          ))}
        </select>
      </FormField>
      <FormField label="Serviced at">
        <input type="date" value={draft.servicedAt} onChange={updateField("servicedAt")} disabled={disabled} required />
      </FormField>
      <FormField label="Cost">
        <input type="number" step="0.01" value={draft.cost} onChange={updateField("cost")} disabled={disabled} />
      </FormField>
      <FormField label="Notes" fullWidth>
        <textarea value={draft.notes} onChange={updateField("notes")} disabled={disabled} rows={5} />
      </FormField>
      <div className="form-actions">
        <button className="button-primary" type="submit" disabled={disabled}>{disabled ? tx("Saving...") : submitLabel}</button>
      </div>
    </form>
  )
}

type DocumentEntities = {
  projects: Project[]
  vendors: Vendor[]
  quotes: Quote[]
  appliances: Appliance[]
  maintenance: MaintenanceItem[]
  incidents: Incident[]
}

function DocumentForm({
  mode,
  draft,
  file,
  disabled,
  entities,
  onChange,
  onFileChange,
  onSubmit,
  submitLabel,
}: {
  mode: "create" | "edit"
  draft: DocumentDraft
  file: File | null
  disabled: boolean
  entities: DocumentEntities
  onChange: (next: DocumentDraft) => void
  onFileChange: (next: File | null) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  submitLabel: string
}) {
  const { tx } = useI18n()

  function updateField(field: keyof DocumentDraft) {
    return (event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      const nextValue = event.target.value
      if (field === "entityKind") {
        onChange({ ...draft, entityKind: nextValue, entityID: "" })
        return
      }
      onChange({ ...draft, [field]: nextValue })
    }
  }

  return (
    <form className="form-grid" onSubmit={onSubmit}>
      {mode === "create" ? (
        <FormField label="File" fullWidth>
          <input
            type="file"
            onChange={(event) => onFileChange(event.target.files?.[0] ?? null)}
            disabled={disabled}
            required
          />
          {file ? <small>{file.name}</small> : null}
        </FormField>
      ) : null}
      <FormField label="Title">
        <input value={draft.title} onChange={updateField("title")} disabled={disabled} />
      </FormField>
      <FormField label="Entity kind">
        <select value={draft.entityKind} onChange={updateField("entityKind")} disabled={disabled}>
          {documentEntityOptions.map((option) => (
            <option key={option.value} value={option.value}>{tx(option.label)}</option>
          ))}
        </select>
      </FormField>
      <FormField label="Linked record">
        <select value={draft.entityID} onChange={updateField("entityID")} disabled={disabled || !draft.entityKind}>
          <option value="">{tx("No linked record")}</option>
          {documentEntityChoices(draft.entityKind, entities).map((choice) => (
            <option key={choice.id} value={choice.id}>{choice.label}</option>
          ))}
        </select>
      </FormField>
      <FormField label="Notes" fullWidth>
        <textarea value={draft.notes} onChange={updateField("notes")} disabled={disabled} rows={5} />
      </FormField>
      <div className="form-actions">
        <button className="button-primary" type="submit" disabled={disabled}>{disabled ? tx("Saving...") : submitLabel}</button>
      </div>
    </form>
  )
}

function FormField({ label, children, fullWidth = false }: { label: string; children: ReactNode; fullWidth?: boolean }) {
  const { tx } = useI18n()

  return (
    <label className={fullWidth ? "form-field form-field-full" : "form-field"}>
      <span>{tx(label)}</span>
      {children}
    </label>
  )
}

function DetailList({ rows }: { rows: Array<[string, string]> }) {
  const { tx } = useI18n()

  return (
    <dl className="detail-list">
      {rows.map(([label, value]) => (
        <div key={label} className="detail-row">
          <dt>{tx(label)}</dt>
          <dd>{tx(value)}</dd>
        </div>
      ))}
    </dl>
  )
}

function InlineError({ message }: { message: string }) {
  return <div className="inline-error">{message}</div>
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="metric">
      <span className="metric-label">{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function SummaryCard({ label, value, note }: { label: string; value: number; note: string }) {
  const { tx } = useI18n()

  return (
    <article className="summary-card">
      <span>{tx(label)}</span>
      <strong>{value}</strong>
      <span className="summary-note">{tx(note)}</span>
    </article>
  )
}

function PageHeader({ title, note }: { title: string; note: string }) {
  const { t, tx } = useI18n()

  return (
    <header className="page-header">
      <span className="page-kicker">{t("page.kicker")}</span>
      <h2>{tx(title)}</h2>
      <p>{tx(note)}</p>
    </header>
  )
}

function Panel({
  title,
  note,
  children,
  actions,
}: {
  title: string
  note: string
  children: ReactNode
  actions?: ReactNode
}) {
  const { tx } = useI18n()

  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h3>{tx(title)}</h3>
          <span>{tx(note)}</span>
        </div>
        {actions ? <div className="panel-actions">{actions}</div> : null}
      </div>
      <div className="panel-body">{children}</div>
    </section>
  )
}

function RecordCard({
  title,
  subtitle,
  meta,
  badge,
  to,
}: {
  title: string
  subtitle: string
  meta?: string
  badge?: ReactNode
  to?: string
}) {
  const { tx } = useI18n()

  const content = (
    <>
      <div className="record-top">
        <strong>{title}</strong>
        {badge}
      </div>
      <p className="record-subtitle">{tx(subtitle)}</p>
      {meta ? <p className="record-meta">{tx(meta)}</p> : null}
    </>
  )

  if (to) {
    return <Link className="record-card record-card-link" to={to}>{content}</Link>
  }

  return <div className="record-card">{content}</div>
}

function EmptyRecord({ message }: { message: string }) {
  const { tx } = useI18n()
  return <div className="empty-state">{tx(message)}</div>
}

function StateGate({ loading, error, empty, children }: { loading: boolean; error: string; empty: boolean; children: ReactNode }) {
  const { t } = useI18n()

  if (loading) {
    return <section className="panel loading-state">{t("state.loading")}</section>
  }

  if (error) {
    return (
      <section className="panel error-state">
        Failed to load data. Likely cause: the HTTP API returned an error ({error}). Refresh the page or check the server logs.
      </section>
    )
  }

  if (empty) {
    return <section className="panel empty-state">{t("state.empty")}</section>
  }

  return <>{children}</>
}

function normalizeHouse(house: HouseProfile | null | undefined) {
  if (!house || !house.id) {
    return null
  }
  return house
}

function houseToDraft(house: HouseProfile): HouseDraft {
  return {
    nickname: house.nickname,
    addressLine1: house.address_line1,
    addressLine2: house.address_line2,
    city: house.city,
    state: house.state,
    postalCode: house.postal_code,
    yearBuilt: stringifyNumber(house.year_built),
    squareFeet: stringifyNumber(house.square_feet),
    lotSquareFeet: stringifyNumber(house.lot_square_feet),
    bedrooms: stringifyNumber(house.bedrooms),
    bathrooms: house.bathrooms ? String(house.bathrooms) : "",
  }
}

function housePayload(draft: HouseDraft) {
  return {
    nickname: draft.nickname.trim(),
    address_line1: draft.addressLine1.trim(),
    address_line2: draft.addressLine2.trim(),
    city: draft.city.trim(),
    state: draft.state.trim(),
    postal_code: draft.postalCode.trim(),
    year_built: parseInteger(draft.yearBuilt),
    square_feet: parseInteger(draft.squareFeet),
    lot_square_feet: parseInteger(draft.lotSquareFeet),
    bedrooms: parseInteger(draft.bedrooms),
    bathrooms: parseFloatOrZero(draft.bathrooms),
  }
}

function emptyHouseDraft(): HouseDraft {
  return {
    nickname: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    state: "",
    postalCode: "",
    yearBuilt: "",
    squareFeet: "",
    lotSquareFeet: "",
    bedrooms: "",
    bathrooms: "",
  }
}

function emptyProjectDraft(): ProjectDraft {
  return {
    title: "",
    projectTypeID: "",
    status: "planned",
    description: "",
    startDate: "",
    endDate: "",
    budget: "",
    actual: "",
  }
}

function projectToDraft(project: Project): ProjectDraft {
  return {
    title: project.title,
    projectTypeID: project.project_type_id,
    status: project.status,
    description: project.description,
    startDate: dateInputValue(project.start_date),
    endDate: dateInputValue(project.end_date),
    budget: moneyInputValue(project.budget_cents),
    actual: moneyInputValue(project.actual_cents),
  }
}

function projectPayload(draft: ProjectDraft) {
  return {
    title: draft.title.trim(),
    project_type_id: draft.projectTypeID,
    status: draft.status,
    description: draft.description.trim(),
    start_date: datePayloadValue(draft.startDate),
    end_date: datePayloadValue(draft.endDate),
    budget_cents: moneyPayloadValue(draft.budget),
    actual_cents: moneyPayloadValue(draft.actual),
  }
}

function emptyVendorDraft(): VendorDraft {
  return {
    name: "",
    contactName: "",
    email: "",
    phone: "",
    website: "",
    notes: "",
    locale: "",
  }
}

function vendorToDraft(vendor: Vendor): VendorDraft {
  return {
    name: vendor.name,
    contactName: vendor.contact_name,
    email: vendor.email,
    phone: vendor.phone,
    website: vendor.website,
    notes: vendor.notes,
    locale: vendor.locale,
  }
}

function vendorPayload(draft: VendorDraft) {
  return {
    name: draft.name.trim(),
    contact_name: draft.contactName.trim(),
    email: draft.email.trim(),
    phone: draft.phone.trim(),
    website: draft.website.trim(),
    notes: draft.notes.trim(),
    locale: draft.locale.trim(),
  }
}

function emptyQuoteDraft(): QuoteDraft {
  return {
    projectID: "",
    vendorID: "",
    total: "",
    labor: "",
    materials: "",
    receivedDate: "",
    notes: "",
  }
}

function quoteToDraft(quote: Quote): QuoteDraft {
  return {
    projectID: quote.project_id,
    vendorID: quote.vendor_id,
    total: moneyInputValue(quote.total_cents),
    labor: moneyInputValue(quote.labor_cents),
    materials: moneyInputValue(quote.materials_cents),
    receivedDate: dateInputValue(quote.received_date),
    notes: quote.notes,
  }
}

function quotePayload(draft: QuoteDraft) {
  return {
    project_id: draft.projectID,
    vendor_id: draft.vendorID,
    total_cents: moneyPayloadValue(draft.total) ?? 0,
    labor_cents: moneyPayloadValue(draft.labor),
    materials_cents: moneyPayloadValue(draft.materials),
    received_date: datePayloadValue(draft.receivedDate),
    notes: draft.notes.trim(),
  }
}

function emptyApplianceDraft(): ApplianceDraft {
  return {
    name: "",
    brand: "",
    modelNumber: "",
    serialNumber: "",
    purchaseDate: "",
    warrantyExpiry: "",
    location: "",
    cost: "",
    notes: "",
  }
}

function applianceToDraft(appliance: Appliance): ApplianceDraft {
  return {
    name: appliance.name,
    brand: appliance.brand,
    modelNumber: appliance.model_number,
    serialNumber: appliance.serial_number,
    purchaseDate: dateInputValue(appliance.purchase_date),
    warrantyExpiry: dateInputValue(appliance.warranty_expiry),
    location: appliance.location,
    cost: moneyInputValue(appliance.cost_cents),
    notes: appliance.notes,
  }
}

function appliancePayload(draft: ApplianceDraft) {
  return {
    name: draft.name.trim(),
    brand: draft.brand.trim(),
    model_number: draft.modelNumber.trim(),
    serial_number: draft.serialNumber.trim(),
    purchase_date: datePayloadValue(draft.purchaseDate),
    warranty_expiry: datePayloadValue(draft.warrantyExpiry),
    location: draft.location.trim(),
    cost_cents: moneyPayloadValue(draft.cost),
    notes: draft.notes.trim(),
  }
}

function emptyMaintenanceDraft(): MaintenanceDraft {
  return {
    name: "",
    categoryID: "",
    applianceID: "",
    season: "",
    lastServicedAt: "",
    intervalMonths: "",
    dueDate: "",
    notes: "",
    cost: "",
  }
}

function maintenanceToDraft(item: MaintenanceItem): MaintenanceDraft {
  return {
    name: item.name,
    categoryID: item.category_id,
    applianceID: item.appliance_id ?? "",
    season: item.season,
    lastServicedAt: dateInputValue(item.last_serviced_at),
    intervalMonths: stringifyNumber(item.interval_months),
    dueDate: dateInputValue(item.due_date),
    notes: item.notes,
    cost: moneyInputValue(item.cost_cents),
  }
}

function maintenancePayload(draft: MaintenanceDraft) {
  const applianceID = draft.applianceID.trim()
  return {
    name: draft.name.trim(),
    category_id: draft.categoryID,
    appliance_id: applianceID || null,
    season: draft.season.trim(),
    last_serviced_at: datePayloadValue(draft.lastServicedAt),
    interval_months: parseInteger(draft.intervalMonths),
    due_date: datePayloadValue(draft.dueDate),
    notes: draft.notes.trim(),
    cost_cents: moneyPayloadValue(draft.cost),
  }
}

function emptyIncidentDraft(): IncidentDraft {
  return {
    title: "",
    description: "",
    status: "open",
    severity: "soon",
    dateNoticed: "",
    dateResolved: "",
    location: "",
    cost: "",
    applianceID: "",
    vendorID: "",
    notes: "",
  }
}

function incidentToDraft(incident: Incident): IncidentDraft {
  return {
    title: incident.title,
    description: incident.description,
    status: incident.status,
    severity: incident.severity,
    dateNoticed: dateInputValue(incident.date_noticed),
    dateResolved: dateInputValue(incident.date_resolved),
    location: incident.location,
    cost: moneyInputValue(incident.cost_cents),
    applianceID: incident.appliance_id ?? "",
    vendorID: incident.vendor_id ?? "",
    notes: incident.notes,
  }
}

function incidentPayload(draft: IncidentDraft) {
  return {
    title: draft.title.trim(),
    description: draft.description.trim(),
    status: draft.status,
    severity: draft.severity,
    date_noticed: datePayloadValue(draft.dateNoticed) ?? new Date().toISOString(),
    date_resolved: datePayloadValue(draft.dateResolved),
    location: draft.location.trim(),
    cost_cents: moneyPayloadValue(draft.cost),
    appliance_id: draft.applianceID.trim() || null,
    vendor_id: draft.vendorID.trim() || null,
    notes: draft.notes.trim(),
  }
}

function emptyDocument(): Document {
  return {
    id: "",
    title: "",
    file_name: "",
    entity_kind: "",
    entity_id: "",
    mime_type: "",
    size_bytes: 0,
    sha256: "",
    extracted_text: "",
    extraction_model: "",
    notes: "",
    created_at: "",
    updated_at: "",
  }
}

function emptyDocumentDraft(): DocumentDraft {
  return {
    title: "",
    entityKind: "",
    entityID: "",
    notes: "",
  }
}

function emptyServiceLogDraft(): ServiceLogDraft {
	return {
		maintenanceItemID: "",
		servicedAt: "",
		vendorID: "",
		cost: "",
		notes: "",
	}
}

function serviceLogToDraft(entry: ServiceLogEntry): ServiceLogDraft {
	return {
		maintenanceItemID: entry.maintenance_item_id,
		servicedAt: dateInputValue(entry.serviced_at),
		vendorID: entry.vendor_id ?? "",
		cost: moneyInputValue(entry.cost_cents),
		notes: entry.notes,
	}
}

function serviceLogPayload(draft: ServiceLogDraft) {
	const vendorID = draft.vendorID.trim()
	return {
		maintenance_item_id: draft.maintenanceItemID,
		serviced_at: datePayloadValue(draft.servicedAt) ?? new Date().toISOString(),
		vendor_id: vendorID || null,
		cost_cents: moneyPayloadValue(draft.cost),
		notes: draft.notes.trim(),
	}
}

function documentToDraft(document: Document): DocumentDraft {
  return {
    title: document.title,
    entityKind: document.entity_kind,
    entityID: document.entity_id,
    notes: document.notes,
  }
}

function documentPayload(draft: DocumentDraft) {
  return {
    title: draft.title.trim(),
    notes: draft.notes.trim(),
  }
}

function projectTypeName(id: string, types: ProjectType[]) {
	const name = types.find((projectType) => projectType.id === id)?.name ?? id
	return translatePhrase(name)
}

function maintenanceCategoryName(id: string, categories: MaintenanceCategory[]) {
	const name = categories.find((category) => category.id === id)?.name ?? id
	return translatePhrase(name)
}

function applianceName(id: string | null | undefined, appliances: Appliance[]) {
  if (!id) {
    return ""
  }
  return appliances.find((appliance) => appliance.id === id)?.name ?? id
}

function projectName(id: string, projects: Project[]) {
  return projects.find((project) => project.id === id)?.title ?? id
}

function vendorName(id: string | null | undefined, vendors: Vendor[]) {
	if (!id) {
		return ""
	}
	return vendors.find((vendor) => vendor.id === id)?.name ?? id
}

function quoteLabel(id: string, quotes: Quote[]) {
	const quote = quotes.find((item) => item.id === id)
	if (!quote) {
		return id
	}
	return quote.notes || quote.id
}

function linkedEntityLabel(entityKind: string, entityID: string, entities: DocumentEntities) {
	if (!entityKind || !entityID) {
		return ""
	}
	switch (entityKind) {
	case "project":
		return `Project: ${projectName(entityID, entities.projects)}`
	case "vendor":
		return `Vendor: ${vendorName(entityID, entities.vendors)}`
	case "quote":
		return `Quote: ${quoteLabel(entityID, entities.quotes)}`
	case "appliance":
		return `Appliance: ${applianceName(entityID, entities.appliances)}`
	case "maintenance":
		return `Maintenance: ${maintenanceName(entityID, entities.maintenance)}`
	case "incident":
		return `Incident: ${incidentName(entityID, entities.incidents)}`
	default:
		return `${entityKind}: ${entityID}`
	}
}

function entityPath(entityKind: string | null | undefined, entityID: string | null | undefined) {
	if (!entityKind || !entityID) {
		return ""
	}
	switch (entityKind) {
	case "project":
		return `/projects/${entityID}`
	case "vendor":
		return `/vendors/${entityID}`
	case "quote":
		return `/quotes/${entityID}`
	case "appliance":
		return `/appliances/${entityID}`
	case "maintenance":
		return `/maintenance/${entityID}`
	case "incident":
		return `/incidents/${entityID}`
	case "service_log":
		return `/service-logs/${entityID}`
	case "document":
		return `/documents/${entityID}`
	default:
		return ""
	}
}

function documentEntityChoices(entityKind: string, entities: DocumentEntities): Array<{ id: string; label: string }> {
	switch (entityKind) {
	case "project":
		return entities.projects.map((item) => ({ id: item.id, label: item.title }))
	case "vendor":
		return entities.vendors.map((item) => ({ id: item.id, label: item.name }))
	case "quote":
		return entities.quotes.map((item) => ({ id: item.id, label: quoteLabel(item.id, entities.quotes) }))
	case "appliance":
		return entities.appliances.map((item) => ({ id: item.id, label: item.name }))
	case "maintenance":
		return entities.maintenance.map((item) => ({ id: item.id, label: item.name }))
	case "incident":
		return entities.incidents.map((item) => ({ id: item.id, label: item.title }))
	default:
		return []
	}
}

function maintenanceName(id: string | null | undefined, items: MaintenanceItem[]) {
	if (!id) {
		return ""
	}
	return items.find((item) => item.id === id)?.name ?? id
}

function incidentName(id: string | null | undefined, incidents: Incident[]) {
	if (!id) {
		return ""
	}
	return incidents.find((item) => item.id === id)?.title ?? id
}

function statusBadge(value: string) {
  const { tx } = useI18n()
  const normalized = value.toLowerCase().replaceAll(" ", "_")
  return <span className={`status-badge status-${normalized}`}>{tx(value.replaceAll("_", " "))}</span>
}

function joinMeta(parts: Array<string | undefined | null>) {
  return parts.filter(Boolean).join(" · ")
}

function formatDate(value?: string | null) {
  if (!value) {
    return ""
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return ""
  }

	return new Intl.DateTimeFormat(getCurrentLocale(), { dateStyle: "medium" }).format(date)
}

function formatMoney(cents?: number | null, currencyCode = "USD") {
  if (cents == null) {
    return ""
  }

	try {
		return new Intl.NumberFormat(getCurrentLocale(), {
			style: "currency",
			currency: currencyCode,
			maximumFractionDigits: 0,
		}).format(cents / 100)
	} catch {
		return `${(cents / 100).toLocaleString(getCurrentLocale(), { maximumFractionDigits: 0 })}`
	}
}

function moneyInputValue(cents?: number | null) {
  if (cents == null) {
    return ""
  }
  return (cents / 100).toFixed(2)
}

function moneyPayloadValue(value: string) {
  const trimmed = value.trim()
  if (!trimmed) {
    return null
  }
  const parsed = Number(trimmed)
  if (!Number.isFinite(parsed)) {
    return null
  }
  return Math.round(parsed * 100)
}

function dateInputValue(value?: string | null) {
  if (!value) {
    return ""
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return ""
  }
  return date.toISOString().slice(0, 10)
}

function datePayloadValue(value: string) {
  const trimmed = value.trim()
  if (!trimmed) {
    return null
  }
  return `${trimmed}T00:00:00Z`
}

function parseInteger(value: string) {
  const trimmed = value.trim()
  if (!trimmed) {
    return 0
  }
  const parsed = Number.parseInt(trimmed, 10)
  return Number.isFinite(parsed) ? parsed : 0
}

function parseFloatOrZero(value: string) {
  const trimmed = value.trim()
  if (!trimmed) {
    return 0
  }
  const parsed = Number.parseFloat(trimmed)
  return Number.isFinite(parsed) ? parsed : 0
}

function stringifyNumber(value?: number | null) {
  if (!value) {
    return ""
  }
  return String(value)
}

function formatBytes(bytes: number) {
  if (bytes <= 0) {
    return "0 B"
  }

  const units = ["B", "KB", "MB", "GB"]
  let value = bytes
  let unit = units[0]

  for (const next of units) {
    unit = next
    if (value < 1024 || next === units[units.length - 1]) {
      break
    }
    value /= 1024
  }

  return `${value.toFixed(value < 10 && unit !== "B" ? 1 : 0)} ${unit}`
}

function valueOrDash(value?: string | number | null) {
	if (value == null || value === 0 || value === "") {
		return "-"
	}

	return value
}

function formatAreaDisplay(squareFeet: number, unitSystem: string) {
	if (!squareFeet) {
		return "-"
	}
	if (unitSystem === "metric") {
		const squareMeters = Math.round(squareFeet / 10.7639104)
		return `${squareMeters.toLocaleString(getCurrentLocale())} m²`
	}
	return `${squareFeet.toLocaleString(getCurrentLocale())} ft²`
}
