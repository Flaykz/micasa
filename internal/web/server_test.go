// Copyright 2026 Phillip Cloud
// Licensed under the Apache License, Version 2.0

//nolint:noctx // httptest requests carry their own context
package web

import (
	"bytes"
	"encoding/json"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/micasa-dev/micasa/internal/config"
	"github.com/micasa-dev/micasa/internal/data"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func newTestServer(t *testing.T) http.Handler {
	t.Helper()
	h, _ := newTestServerWithStore(t, true)
	return h
}

func newTestServerWithStore(t *testing.T, seedDemo bool) (http.Handler, *data.Store) {
	t.Helper()

	store, err := data.Open(":memory:")
	require.NoError(t, err)
	t.Cleanup(func() { require.NoError(t, store.Close()) })

	require.NoError(t, store.AutoMigrate())
	require.NoError(t, store.SeedDefaults())
	require.NoError(t, store.SetMaxDocumentSize(50<<20))
	if seedDemo {
		require.NoError(t, store.SeedDemoData())
	}

	server := NewServer(store)
	server.loadConfig = func() (config.Config, error) {
		var cfg config.Config
		data.ApplyDefaults(&cfg)
		cfg.Chat.LLM.Provider = config.DefaultProvider
		cfg.Chat.LLM.BaseURL = config.DefaultBaseURL
		cfg.Chat.LLM.Model = config.DefaultModel
		cfg.Chat.LLM.Timeout = config.DefaultLLMTimeout.String()
		return cfg, nil
	}

	return server, store
}

func TestGetSettingsReturnsSharedAndSystemConfig(t *testing.T) {
	t.Parallel()

	h, store := newTestServerWithStore(t, false)
	require.NoError(t, store.PutCurrency("EUR"))
	require.NoError(t, store.PutUnitSystem(data.UnitsMetric))

	req := httptest.NewRequest(http.MethodGet, "/api/settings", nil)
	rec := httptest.NewRecorder()

	h.ServeHTTP(rec, req)

	require.Equal(t, http.StatusOK, rec.Code)
	var resp struct {
		Shared struct {
			Currency   string `json:"currency"`
			UnitSystem string `json:"unit_system"`
		} `json:"shared"`
		System struct {
			AddressAutofill      bool   `json:"address_autofill"`
			DocumentsMaxFileSize string `json:"documents_max_file_size"`
			DocumentsCacheTTL    string `json:"documents_cache_ttl"`
			ChatProvider         string `json:"chat_provider"`
			ChatModel            string `json:"chat_model"`
			ExtractionMaxPages   int    `json:"extraction_max_pages"`
			ExtractionOCREnabled bool   `json:"extraction_ocr_enabled"`
			ExtractionLLMEnabled bool   `json:"extraction_llm_enabled"`
		} `json:"system"`
	}
	require.NoError(t, json.NewDecoder(rec.Body).Decode(&resp))
	assert.Equal(t, "EUR", resp.Shared.Currency)
	assert.Equal(t, "metric", resp.Shared.UnitSystem)
	assert.False(t, resp.System.AddressAutofill)
	assert.NotEmpty(t, resp.System.DocumentsMaxFileSize)
	assert.NotEmpty(t, resp.System.DocumentsCacheTTL)
	assert.Equal(t, "ollama", resp.System.ChatProvider)
	assert.Equal(t, "qwen3", resp.System.ChatModel)
	assert.Equal(t, 0, resp.System.ExtractionMaxPages)
	assert.True(t, resp.System.ExtractionOCREnabled)
	assert.True(t, resp.System.ExtractionLLMEnabled)
}

func TestPutSettingsUpdatesSharedSettings(t *testing.T) {
	t.Parallel()

	h, store := newTestServerWithStore(t, false)
	body := map[string]any{
		"shared": map[string]any{
			"currency":    "GBP",
			"unit_system": "metric",
		},
	}
	req := jsonRequest(t, http.MethodPut, "/api/settings", body)
	rec := httptest.NewRecorder()

	h.ServeHTTP(rec, req)

	require.Equal(t, http.StatusOK, rec.Code)
	var resp struct {
		Shared struct {
			Currency   string `json:"currency"`
			UnitSystem string `json:"unit_system"`
		} `json:"shared"`
	}
	require.NoError(t, json.NewDecoder(rec.Body).Decode(&resp))
	assert.Equal(t, "GBP", resp.Shared.Currency)
	assert.Equal(t, "metric", resp.Shared.UnitSystem)

	currency, err := store.GetCurrency()
	require.NoError(t, err)
	assert.Equal(t, "GBP", currency)
	unitSystem, err := store.GetUnitSystem()
	require.NoError(t, err)
	assert.Equal(t, data.UnitsMetric, unitSystem)
}

func TestRootServesEmbeddedAppShell(t *testing.T) {
	t.Parallel()

	h := newTestServer(t)
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	rec := httptest.NewRecorder()

	h.ServeHTTP(rec, req)

	require.Equal(t, http.StatusOK, rec.Code)
	assert.Contains(t, rec.Header().Get("Content-Type"), "text/html")
	assert.Contains(t, rec.Body.String(), "<title>micasa</title>")
	assert.Contains(t, rec.Body.String(), "<div id=\"root\"></div>")
	assert.Contains(t, rec.Body.String(), "type=\"module\"")
}

func TestClientRouteServesEmbeddedAppShell(t *testing.T) {
	t.Parallel()

	h := newTestServer(t)
	req := httptest.NewRequest(http.MethodGet, "/projects", nil)
	rec := httptest.NewRecorder()

	h.ServeHTTP(rec, req)

	require.Equal(t, http.StatusOK, rec.Code)
	assert.Contains(t, rec.Header().Get("Content-Type"), "text/html")
	assert.Contains(t, rec.Body.String(), "<div id=\"root\"></div>")
}

func TestDashboardEndpointReturnsSeededSections(t *testing.T) {
	t.Parallel()

	h := newTestServer(t)
	req := httptest.NewRequest(http.MethodGet, "/api/dashboard", nil)
	rec := httptest.NewRecorder()

	h.ServeHTTP(rec, req)

	require.Equal(t, http.StatusOK, rec.Code)
	assert.Contains(t, rec.Body.String(), "active_projects")

	var resp struct {
		Incidents          []data.Incident        `json:"incidents"`
		Maintenance        []data.MaintenanceItem `json:"maintenance"`
		ActiveProjects     []data.Project         `json:"active_projects"`
		ExpiringWarranties []data.Appliance       `json:"expiring_warranties"`
		House              *data.HouseProfile     `json:"house"`
		RecentServiceLogs  []data.ServiceLogEntry `json:"recent_service_logs"`
		YTDServiceSpend    int64                  `json:"ytd_service_spend_cents"`
		TotalProjectSpend  int64                  `json:"total_project_spend_cents"`
	}
	require.NoError(t, json.NewDecoder(rec.Body).Decode(&resp))
	require.NotNil(t, resp.House)
	assert.NotEmpty(t, resp.ActiveProjects)
	assert.NotEmpty(t, resp.Maintenance)
	assert.NotEmpty(t, resp.Incidents)
	assert.NotZero(t, resp.TotalProjectSpend)
}

func TestProjectsEndpointReturnsSeededProjects(t *testing.T) {
	t.Parallel()

	h := newTestServer(t)
	req := httptest.NewRequest(http.MethodGet, "/api/projects", nil)
	rec := httptest.NewRecorder()

	h.ServeHTTP(rec, req)

	require.Equal(t, http.StatusOK, rec.Code)
	assert.Contains(t, rec.Header().Get("Content-Type"), "application/json")

	var projects []data.Project
	require.NoError(t, json.NewDecoder(rec.Body).Decode(&projects))
	require.NotEmpty(t, projects)
	assert.NotEmpty(t, projects[0].Title)
	assert.NotEmpty(t, projects[0].ProjectTypeID)
}

func TestVendorsEndpointReturnsSeededVendors(t *testing.T) {
	t.Parallel()

	h := newTestServer(t)
	req := httptest.NewRequest(http.MethodGet, "/api/vendors", nil)
	rec := httptest.NewRecorder()

	h.ServeHTTP(rec, req)

	require.Equal(t, http.StatusOK, rec.Code)

	var vendors []data.Vendor
	require.NoError(t, json.NewDecoder(rec.Body).Decode(&vendors))
	require.NotEmpty(t, vendors)
	assert.NotEmpty(t, vendors[0].Name)
}

func TestPutHouseCreatesProfileWhenMissing(t *testing.T) {
	t.Parallel()

	h, _ := newTestServerWithStore(t, false)
	body := data.HouseProfile{
		Nickname:     "Maison Atlas",
		AddressLine1: "12 Rue des Tuiles",
		City:         "Lyon",
		State:        "Auvergne-Rhone-Alpes",
		PostalCode:   "69001",
		YearBuilt:    1987,
		SquareFeet:   1650,
		Bedrooms:     3,
		Bathrooms:    2,
	}
	req := jsonRequest(t, http.MethodPut, "/api/house", body)
	rec := httptest.NewRecorder()

	h.ServeHTTP(rec, req)

	require.Equal(t, http.StatusOK, rec.Code)
	var got data.HouseProfile
	require.NoError(t, json.NewDecoder(rec.Body).Decode(&got))
	assert.NotEmpty(t, got.ID)
	assert.Equal(t, body.Nickname, got.Nickname)
	assert.Equal(t, body.City, got.City)
}

func TestPutHouseUpdatesExistingProfile(t *testing.T) {
	t.Parallel()

	h, _ := newTestServerWithStore(t, true)
	body := data.HouseProfile{
		Nickname:     "Maison Retapee",
		AddressLine1: "99 Quai des Fleurs",
		City:         "Nantes",
		State:        "Pays de la Loire",
		PostalCode:   "44000",
		YearBuilt:    2004,
		SquareFeet:   2100,
		Bedrooms:     4,
		Bathrooms:    3,
	}
	req := jsonRequest(t, http.MethodPut, "/api/house", body)
	rec := httptest.NewRecorder()

	h.ServeHTTP(rec, req)

	require.Equal(t, http.StatusOK, rec.Code)
	var got data.HouseProfile
	require.NoError(t, json.NewDecoder(rec.Body).Decode(&got))
	assert.Equal(t, body.Nickname, got.Nickname)
	assert.Equal(t, body.AddressLine1, got.AddressLine1)
	assert.Equal(t, body.Bedrooms, got.Bedrooms)
}

func TestGetProjectReturnsSeededProject(t *testing.T) {
	t.Parallel()

	h, store := newTestServerWithStore(t, true)
	projects, err := store.ListProjects(false)
	require.NoError(t, err)
	require.NotEmpty(t, projects)

	req := httptest.NewRequest(http.MethodGet, "/api/projects/"+projects[0].ID, nil)
	rec := httptest.NewRecorder()

	h.ServeHTTP(rec, req)

	require.Equal(t, http.StatusOK, rec.Code)
	var got data.Project
	require.NoError(t, json.NewDecoder(rec.Body).Decode(&got))
	assert.Equal(t, projects[0].ID, got.ID)
	assert.Equal(t, projects[0].Title, got.Title)
}

func TestPostProjectCreatesProject(t *testing.T) {
	t.Parallel()

	h, store := newTestServerWithStore(t, false)
	projectTypeID := firstProjectTypeID(t, store)
	body := data.Project{
		Title:         "Refaire la salle de bains",
		ProjectTypeID: projectTypeID,
		Status:        data.ProjectStatusPlanned,
		Description:   "Douche italienne et nouveaux carrelages.",
	}
	req := jsonRequest(t, http.MethodPost, "/api/projects", body)
	rec := httptest.NewRecorder()

	h.ServeHTTP(rec, req)

	require.Equal(t, http.StatusCreated, rec.Code)
	var got data.Project
	require.NoError(t, json.NewDecoder(rec.Body).Decode(&got))
	assert.NotEmpty(t, got.ID)
	assert.Equal(t, body.Title, got.Title)
	assert.Equal(t, body.ProjectTypeID, got.ProjectTypeID)
}

func TestPutProjectUpdatesProject(t *testing.T) {
	t.Parallel()

	h, store := newTestServerWithStore(t, true)
	projects, err := store.ListProjects(false)
	require.NoError(t, err)
	require.NotEmpty(t, projects)
	project := projects[0]
	project.Title = project.Title + " mis a jour"
	project.Description = "Description mise a jour depuis le web"
	project.Status = data.ProjectStatusInProgress

	req := jsonRequest(t, http.MethodPut, "/api/projects/"+project.ID, project)
	rec := httptest.NewRecorder()

	h.ServeHTTP(rec, req)

	require.Equal(t, http.StatusOK, rec.Code)
	var got data.Project
	require.NoError(t, json.NewDecoder(rec.Body).Decode(&got))
	assert.Equal(t, project.ID, got.ID)
	assert.Equal(t, project.Title, got.Title)
	assert.Equal(t, project.Status, got.Status)
}

func TestDeleteProjectSoftDeletesProject(t *testing.T) {
	t.Parallel()

	h, store := newTestServerWithStore(t, false)
	projectTypeID := firstProjectTypeID(t, store)
	project := data.Project{
		Title:         "Supprimer le vieux cabanon",
		ProjectTypeID: projectTypeID,
		Status:        data.ProjectStatusPlanned,
	}
	require.NoError(t, store.CreateProject(&project))

	req := httptest.NewRequest(http.MethodDelete, "/api/projects/"+project.ID, nil)
	rec := httptest.NewRecorder()

	h.ServeHTTP(rec, req)

	require.Equal(t, http.StatusNoContent, rec.Code)
	deleted, err := store.ListProjects(false)
	require.NoError(t, err)
	assert.Empty(t, deleted)
}

func TestGetVendorReturnsVendor(t *testing.T) {
	t.Parallel()

	h, store := newTestServerWithStore(t, false)
	vendor := createVendorFixture(t, store)

	req := httptest.NewRequest(http.MethodGet, "/api/vendors/"+vendor.ID, nil)
	rec := httptest.NewRecorder()

	h.ServeHTTP(rec, req)

	require.Equal(t, http.StatusOK, rec.Code)
	var got data.Vendor
	require.NoError(t, json.NewDecoder(rec.Body).Decode(&got))
	assert.Equal(t, vendor.ID, got.ID)
	assert.Equal(t, vendor.Name, got.Name)
}

func TestPostVendorCreatesVendor(t *testing.T) {
	t.Parallel()

	h, _ := newTestServerWithStore(t, false)
	body := data.Vendor{
		Name:        "Atelier Atlas",
		ContactName: "Lea Martin",
		Email:       "lea@atelier.example",
		Phone:       "0102030405",
		Website:     "https://atelier.example",
		Notes:       "Electrician and finish carpentry",
	}
	req := jsonRequest(t, http.MethodPost, "/api/vendors", body)
	rec := httptest.NewRecorder()

	h.ServeHTTP(rec, req)

	require.Equal(t, http.StatusCreated, rec.Code)
	var got data.Vendor
	require.NoError(t, json.NewDecoder(rec.Body).Decode(&got))
	assert.NotEmpty(t, got.ID)
	assert.Equal(t, body.Name, got.Name)
}

func TestPutVendorUpdatesVendor(t *testing.T) {
	t.Parallel()

	h, store := newTestServerWithStore(t, false)
	vendor := createVendorFixture(t, store)
	vendor.ContactName = "Camille Robert"
	vendor.Notes = "Updated from web"

	req := jsonRequest(t, http.MethodPut, "/api/vendors/"+vendor.ID, vendor)
	rec := httptest.NewRecorder()

	h.ServeHTTP(rec, req)

	require.Equal(t, http.StatusOK, rec.Code)
	var got data.Vendor
	require.NoError(t, json.NewDecoder(rec.Body).Decode(&got))
	assert.Equal(t, vendor.ID, got.ID)
	assert.Equal(t, vendor.ContactName, got.ContactName)
	assert.Equal(t, vendor.Notes, got.Notes)
}

func TestDeleteVendorSoftDeletesVendor(t *testing.T) {
	t.Parallel()

	h, store := newTestServerWithStore(t, false)
	vendor := createVendorFixture(t, store)

	req := httptest.NewRequest(http.MethodDelete, "/api/vendors/"+vendor.ID, nil)
	rec := httptest.NewRecorder()

	h.ServeHTTP(rec, req)

	require.Equal(t, http.StatusNoContent, rec.Code)
	vendors, err := store.ListVendors(false)
	require.NoError(t, err)
	assert.Empty(t, vendors)
}

func TestGetQuoteReturnsQuote(t *testing.T) {
	t.Parallel()

	h, store := newTestServerWithStore(t, false)
	vendor := createVendorFixture(t, store)
	project := createProjectFixture(t, store)
	quote := createQuoteFixture(t, store, project.ID, vendor)

	req := httptest.NewRequest(http.MethodGet, "/api/quotes/"+quote.ID, nil)
	rec := httptest.NewRecorder()

	h.ServeHTTP(rec, req)

	require.Equal(t, http.StatusOK, rec.Code)
	var got data.Quote
	require.NoError(t, json.NewDecoder(rec.Body).Decode(&got))
	assert.Equal(t, quote.ID, got.ID)
	assert.Equal(t, quote.ProjectID, got.ProjectID)
	assert.Equal(t, quote.VendorID, got.VendorID)
}

func TestListProjectQuotesReturnsProjectQuotes(t *testing.T) {
	t.Parallel()

	h, store := newTestServerWithStore(t, false)
	vendor := createVendorFixture(t, store)
	project := createProjectFixture(t, store)
	quote := createQuoteFixture(t, store, project.ID, vendor)

	req := httptest.NewRequest(http.MethodGet, "/api/projects/"+project.ID+"/quotes", nil)
	rec := httptest.NewRecorder()

	h.ServeHTTP(rec, req)

	require.Equal(t, http.StatusOK, rec.Code)
	var quotes []data.Quote
	require.NoError(t, json.NewDecoder(rec.Body).Decode(&quotes))
	require.Len(t, quotes, 1)
	assert.Equal(t, quote.ID, quotes[0].ID)
}

func TestPostQuoteCreatesQuote(t *testing.T) {
	t.Parallel()

	h, store := newTestServerWithStore(t, false)
	vendor := createVendorFixture(t, store)
	project := createProjectFixture(t, store)
	body := data.Quote{
		ProjectID:      project.ID,
		VendorID:       vendor.ID,
		TotalCents:     185000,
		LaborCents:     int64Ptr(120000),
		MaterialsCents: int64Ptr(65000),
		Notes:          "New kitchen cabinets and install",
	}
	req := jsonRequest(t, http.MethodPost, "/api/quotes", body)
	rec := httptest.NewRecorder()

	h.ServeHTTP(rec, req)

	require.Equal(t, http.StatusCreated, rec.Code)
	var got data.Quote
	require.NoError(t, json.NewDecoder(rec.Body).Decode(&got))
	assert.NotEmpty(t, got.ID)
	assert.Equal(t, project.ID, got.ProjectID)
	assert.Equal(t, vendor.ID, got.VendorID)
}

func TestPutQuoteUpdatesQuote(t *testing.T) {
	t.Parallel()

	h, store := newTestServerWithStore(t, false)
	vendor := createVendorFixture(t, store)
	project := createProjectFixture(t, store)
	quote := createQuoteFixture(t, store, project.ID, vendor)
	quote.TotalCents = 210000
	quote.Notes = "Updated from web"

	req := jsonRequest(t, http.MethodPut, "/api/quotes/"+quote.ID, quote)
	rec := httptest.NewRecorder()

	h.ServeHTTP(rec, req)

	require.Equal(t, http.StatusOK, rec.Code)
	var got data.Quote
	require.NoError(t, json.NewDecoder(rec.Body).Decode(&got))
	assert.Equal(t, quote.ID, got.ID)
	assert.Equal(t, quote.TotalCents, got.TotalCents)
	assert.Equal(t, quote.Notes, got.Notes)
}

func TestDeleteQuoteSoftDeletesQuote(t *testing.T) {
	t.Parallel()

	h, store := newTestServerWithStore(t, false)
	vendor := createVendorFixture(t, store)
	project := createProjectFixture(t, store)
	quote := createQuoteFixture(t, store, project.ID, vendor)

	req := httptest.NewRequest(http.MethodDelete, "/api/quotes/"+quote.ID, nil)
	rec := httptest.NewRecorder()

	h.ServeHTTP(rec, req)

	require.Equal(t, http.StatusNoContent, rec.Code)
	quotes, err := store.ListQuotes(false)
	require.NoError(t, err)
	assert.Empty(t, quotes)
}

func TestGetApplianceReturnsAppliance(t *testing.T) {
	t.Parallel()

	h, store := newTestServerWithStore(t, false)
	appliance := createApplianceFixture(t, store)

	req := httptest.NewRequest(http.MethodGet, "/api/appliances/"+appliance.ID, nil)
	rec := httptest.NewRecorder()

	h.ServeHTTP(rec, req)

	require.Equal(t, http.StatusOK, rec.Code)
	var got data.Appliance
	require.NoError(t, json.NewDecoder(rec.Body).Decode(&got))
	assert.Equal(t, appliance.ID, got.ID)
	assert.Equal(t, appliance.Name, got.Name)
}

func TestPostApplianceCreatesAppliance(t *testing.T) {
	t.Parallel()

	h, _ := newTestServerWithStore(t, false)
	body := data.Appliance{
		Name:           "Heat Pump",
		Brand:          "Mitsui",
		ModelNumber:    "HP-9000",
		SerialNumber:   "SN-12345",
		Location:       "Garage",
		CostCents:      int64Ptr(420000),
		WarrantyExpiry: timePtrRFC3339("2030-06-01T00:00:00Z"),
		Notes:          "Installed during 2026 retrofit",
	}
	req := jsonRequest(t, http.MethodPost, "/api/appliances", body)
	rec := httptest.NewRecorder()

	h.ServeHTTP(rec, req)

	require.Equal(t, http.StatusCreated, rec.Code)
	var got data.Appliance
	require.NoError(t, json.NewDecoder(rec.Body).Decode(&got))
	assert.NotEmpty(t, got.ID)
	assert.Equal(t, body.Name, got.Name)
	assert.Equal(t, body.Location, got.Location)
}

func TestPutApplianceUpdatesAppliance(t *testing.T) {
	t.Parallel()

	h, store := newTestServerWithStore(t, false)
	appliance := createApplianceFixture(t, store)
	appliance.Location = "Attic"
	appliance.Notes = "Moved and updated from web"

	req := jsonRequest(t, http.MethodPut, "/api/appliances/"+appliance.ID, appliance)
	rec := httptest.NewRecorder()

	h.ServeHTTP(rec, req)

	require.Equal(t, http.StatusOK, rec.Code)
	var got data.Appliance
	require.NoError(t, json.NewDecoder(rec.Body).Decode(&got))
	assert.Equal(t, appliance.ID, got.ID)
	assert.Equal(t, appliance.Location, got.Location)
	assert.Equal(t, appliance.Notes, got.Notes)
}

func TestDeleteApplianceSoftDeletesAppliance(t *testing.T) {
	t.Parallel()

	h, store := newTestServerWithStore(t, false)
	appliance := createApplianceFixture(t, store)

	req := httptest.NewRequest(http.MethodDelete, "/api/appliances/"+appliance.ID, nil)
	rec := httptest.NewRecorder()

	h.ServeHTTP(rec, req)

	require.Equal(t, http.StatusNoContent, rec.Code)
	appliances, err := store.ListAppliances(false)
	require.NoError(t, err)
	assert.Empty(t, appliances)
}

func TestGetMaintenanceReturnsMaintenanceItem(t *testing.T) {
	t.Parallel()

	h, store := newTestServerWithStore(t, false)
	appliance := createApplianceFixture(t, store)
	item := createMaintenanceFixture(t, store, &appliance.ID)

	req := httptest.NewRequest(http.MethodGet, "/api/maintenance/"+item.ID, nil)
	rec := httptest.NewRecorder()

	h.ServeHTTP(rec, req)

	require.Equal(t, http.StatusOK, rec.Code)
	var got data.MaintenanceItem
	require.NoError(t, json.NewDecoder(rec.Body).Decode(&got))
	assert.Equal(t, item.ID, got.ID)
	assert.Equal(t, item.Name, got.Name)
}

func TestListApplianceMaintenanceReturnsLinkedItems(t *testing.T) {
	t.Parallel()

	h, store := newTestServerWithStore(t, false)
	appliance := createApplianceFixture(t, store)
	item := createMaintenanceFixture(t, store, &appliance.ID)

	req := httptest.NewRequest(http.MethodGet, "/api/appliances/"+appliance.ID+"/maintenance", nil)
	rec := httptest.NewRecorder()

	h.ServeHTTP(rec, req)

	require.Equal(t, http.StatusOK, rec.Code)
	var items []data.MaintenanceItem
	require.NoError(t, json.NewDecoder(rec.Body).Decode(&items))
	require.Len(t, items, 1)
	assert.Equal(t, item.ID, items[0].ID)
}

func TestPostMaintenanceCreatesMaintenanceItem(t *testing.T) {
	t.Parallel()

	h, store := newTestServerWithStore(t, false)
	appliance := createApplianceFixture(t, store)
	body := data.MaintenanceItem{
		Name:           "Replace intake filter",
		CategoryID:     firstMaintenanceCategoryID(t, store),
		ApplianceID:    &appliance.ID,
		Season:         data.SeasonFall,
		IntervalMonths: 6,
		Notes:          "Use MERV 13 replacement",
		CostCents:      int64Ptr(4500),
	}
	req := jsonRequest(t, http.MethodPost, "/api/maintenance", body)
	rec := httptest.NewRecorder()

	h.ServeHTTP(rec, req)

	require.Equal(t, http.StatusCreated, rec.Code)
	var got data.MaintenanceItem
	require.NoError(t, json.NewDecoder(rec.Body).Decode(&got))
	assert.NotEmpty(t, got.ID)
	assert.Equal(t, body.Name, got.Name)
	assert.Equal(t, body.IntervalMonths, got.IntervalMonths)
}

func TestPutMaintenanceUpdatesMaintenanceItem(t *testing.T) {
	t.Parallel()

	h, store := newTestServerWithStore(t, false)
	appliance := createApplianceFixture(t, store)
	item := createMaintenanceFixture(t, store, &appliance.ID)
	item.IntervalMonths = 12
	item.Notes = "Updated from web"

	req := jsonRequest(t, http.MethodPut, "/api/maintenance/"+item.ID, item)
	rec := httptest.NewRecorder()

	h.ServeHTTP(rec, req)

	require.Equal(t, http.StatusOK, rec.Code)
	var got data.MaintenanceItem
	require.NoError(t, json.NewDecoder(rec.Body).Decode(&got))
	assert.Equal(t, item.ID, got.ID)
	assert.Equal(t, item.IntervalMonths, got.IntervalMonths)
	assert.Equal(t, item.Notes, got.Notes)
}

func TestDeleteMaintenanceSoftDeletesMaintenanceItem(t *testing.T) {
	t.Parallel()

	h, store := newTestServerWithStore(t, false)
	appliance := createApplianceFixture(t, store)
	item := createMaintenanceFixture(t, store, &appliance.ID)

	req := httptest.NewRequest(http.MethodDelete, "/api/maintenance/"+item.ID, nil)
	rec := httptest.NewRecorder()

	h.ServeHTTP(rec, req)

	require.Equal(t, http.StatusNoContent, rec.Code)
	items, err := store.ListMaintenance(false)
	require.NoError(t, err)
	assert.Empty(t, items)
}

func TestGetIncidentReturnsIncident(t *testing.T) {
	t.Parallel()

	h, store := newTestServerWithStore(t, false)
	vendor := createVendorFixture(t, store)
	appliance := createApplianceFixture(t, store)
	incident := createIncidentFixture(t, store, &appliance.ID, &vendor.ID)

	req := httptest.NewRequest(http.MethodGet, "/api/incidents/"+incident.ID, nil)
	rec := httptest.NewRecorder()

	h.ServeHTTP(rec, req)

	require.Equal(t, http.StatusOK, rec.Code)
	var got data.Incident
	require.NoError(t, json.NewDecoder(rec.Body).Decode(&got))
	assert.Equal(t, incident.ID, got.ID)
	assert.Equal(t, incident.Title, got.Title)
	assert.Equal(t, incident.Status, got.Status)
}

func TestPostIncidentCreatesIncident(t *testing.T) {
	t.Parallel()

	h, store := newTestServerWithStore(t, false)
	vendor := createVendorFixture(t, store)
	appliance := createApplianceFixture(t, store)
	body := data.Incident{
		Title:       "Dishwasher leak",
		Description: "Water pooling at the front left corner.",
		Status:      data.IncidentStatusOpen,
		Severity:    data.IncidentSeverityUrgent,
		DateNoticed: mustTime("2026-04-25T12:00:00Z"),
		Location:    "Kitchen",
		CostCents:   int64Ptr(8900),
		ApplianceID: &appliance.ID,
		VendorID:    &vendor.ID,
		Notes:       "Stop using the unit until repaired",
	}
	req := jsonRequest(t, http.MethodPost, "/api/incidents", body)
	rec := httptest.NewRecorder()

	h.ServeHTTP(rec, req)

	require.Equal(t, http.StatusCreated, rec.Code)
	var got data.Incident
	require.NoError(t, json.NewDecoder(rec.Body).Decode(&got))
	assert.NotEmpty(t, got.ID)
	assert.Equal(t, body.Title, got.Title)
	assert.Equal(t, body.Severity, got.Severity)
}

func TestPutIncidentUpdatesIncident(t *testing.T) {
	t.Parallel()

	h, store := newTestServerWithStore(t, false)
	vendor := createVendorFixture(t, store)
	appliance := createApplianceFixture(t, store)
	incident := createIncidentFixture(t, store, &appliance.ID, &vendor.ID)
	incident.Status = data.IncidentStatusInProgress
	incident.Severity = data.IncidentSeveritySoon
	incident.Notes = "Technician booked for Friday"

	req := jsonRequest(t, http.MethodPut, "/api/incidents/"+incident.ID, incident)
	rec := httptest.NewRecorder()

	h.ServeHTTP(rec, req)

	require.Equal(t, http.StatusOK, rec.Code)
	var got data.Incident
	require.NoError(t, json.NewDecoder(rec.Body).Decode(&got))
	assert.Equal(t, incident.ID, got.ID)
	assert.Equal(t, incident.Status, got.Status)
	assert.Equal(t, incident.Notes, got.Notes)
}

func TestDeleteIncidentSoftDeletesIncident(t *testing.T) {
	t.Parallel()

	h, store := newTestServerWithStore(t, false)
	vendor := createVendorFixture(t, store)
	appliance := createApplianceFixture(t, store)
	incident := createIncidentFixture(t, store, &appliance.ID, &vendor.ID)

	req := httptest.NewRequest(http.MethodDelete, "/api/incidents/"+incident.ID, nil)
	rec := httptest.NewRecorder()

	h.ServeHTTP(rec, req)

	require.Equal(t, http.StatusNoContent, rec.Code)
	incidents, err := store.ListIncidents(false)
	require.NoError(t, err)
	assert.Empty(t, incidents)
	deleted, err := store.GetIncident(incident.ID)
	assert.Error(t, err)
	assert.Empty(t, deleted.ID)
	var unscoped data.Incident
	require.NoError(t, store.GormDB().Unscoped().First(&unscoped, "id = ?", incident.ID).Error)
	assert.Equal(t, data.IncidentStatusResolved, unscoped.Status)
}

func TestGetDocumentReturnsDocumentMetadata(t *testing.T) {
	t.Parallel()

	h, store := newTestServerWithStore(t, false)
	project := createProjectFixture(t, store)
	doc := createDocumentFixture(t, store, data.DocumentEntityProject, project.ID)

	req := httptest.NewRequest(http.MethodGet, "/api/documents/"+doc.ID, nil)
	rec := httptest.NewRecorder()

	h.ServeHTTP(rec, req)

	require.Equal(t, http.StatusOK, rec.Code)
	var got data.Document
	require.NoError(t, json.NewDecoder(rec.Body).Decode(&got))
	assert.Equal(t, doc.ID, got.ID)
	assert.Equal(t, doc.Title, got.Title)
	assert.Equal(t, doc.EntityKind, got.EntityKind)
	assert.Equal(t, doc.EntityID, got.EntityID)
}

func TestPostDocumentUploadsDocument(t *testing.T) {
	t.Parallel()

	h, store := newTestServerWithStore(t, false)
	project := createProjectFixture(t, store)
	req := multipartDocumentRequest(t, "/api/documents", multipartDocumentPayload{
		Title:      "Inspection report",
		EntityKind: data.DocumentEntityProject,
		EntityID:   project.ID,
		Notes:      "Uploaded from web",
		FileName:   "inspection-report.txt",
		MIMEType:   "text/plain",
		Content:    []byte("report body"),
	})
	rec := httptest.NewRecorder()

	h.ServeHTTP(rec, req)

	require.Equal(t, http.StatusCreated, rec.Code)
	var got data.Document
	require.NoError(t, json.NewDecoder(rec.Body).Decode(&got))
	assert.NotEmpty(t, got.ID)
	assert.Equal(t, "Inspection report", got.Title)
	assert.Equal(t, data.DocumentEntityProject, got.EntityKind)
	assert.Equal(t, project.ID, got.EntityID)
	assert.Equal(t, int64(len("report body")), got.SizeBytes)
}

func TestDownloadDocumentStreamsBinaryContent(t *testing.T) {
	t.Parallel()

	h, store := newTestServerWithStore(t, false)
	project := createProjectFixture(t, store)
	doc := createDocumentFixture(t, store, data.DocumentEntityProject, project.ID)

	req := httptest.NewRequest(http.MethodGet, "/api/documents/"+doc.ID+"/download", nil)
	rec := httptest.NewRecorder()

	h.ServeHTTP(rec, req)

	require.Equal(t, http.StatusOK, rec.Code)
	assert.Equal(t, doc.MIMEType, rec.Header().Get("Content-Type"))
	assert.Contains(t, rec.Header().Get("Content-Disposition"), doc.FileName)
	assert.Equal(t, string(doc.Data), rec.Body.String())
}

func TestPutDocumentUpdatesMetadata(t *testing.T) {
	t.Parallel()

	h, store := newTestServerWithStore(t, false)
	project := createProjectFixture(t, store)
	doc := createDocumentFixture(t, store, data.DocumentEntityProject, project.ID)
	update := data.Document{
		Title: "Updated title",
		Notes: "Updated notes from web",
	}
	req := jsonRequest(t, http.MethodPut, "/api/documents/"+doc.ID, update)
	rec := httptest.NewRecorder()

	h.ServeHTTP(rec, req)

	require.Equal(t, http.StatusOK, rec.Code)
	var got data.Document
	require.NoError(t, json.NewDecoder(rec.Body).Decode(&got))
	assert.Equal(t, doc.ID, got.ID)
	assert.Equal(t, update.Title, got.Title)
	assert.Equal(t, update.Notes, got.Notes)
	assert.Equal(t, doc.FileName, got.FileName)
}

func TestDeleteDocumentSoftDeletesDocument(t *testing.T) {
	t.Parallel()

	h, store := newTestServerWithStore(t, false)
	project := createProjectFixture(t, store)
	doc := createDocumentFixture(t, store, data.DocumentEntityProject, project.ID)

	req := httptest.NewRequest(http.MethodDelete, "/api/documents/"+doc.ID, nil)
	rec := httptest.NewRecorder()

	h.ServeHTTP(rec, req)

	require.Equal(t, http.StatusNoContent, rec.Code)
	docs, err := store.ListDocuments(false)
	require.NoError(t, err)
	assert.Empty(t, docs)
}

func TestGetServiceLogReturnsServiceLog(t *testing.T) {
	t.Parallel()

	h, store := newTestServerWithStore(t, false)
	vendor := createVendorFixture(t, store)
	appliance := createApplianceFixture(t, store)
	item := createMaintenanceFixture(t, store, &appliance.ID)
	entry := createServiceLogFixture(t, store, item.ID, vendor)

	req := httptest.NewRequest(http.MethodGet, "/api/service-logs/"+entry.ID, nil)
	rec := httptest.NewRecorder()

	h.ServeHTTP(rec, req)

	require.Equal(t, http.StatusOK, rec.Code)
	var got data.ServiceLogEntry
	require.NoError(t, json.NewDecoder(rec.Body).Decode(&got))
	assert.Equal(t, entry.ID, got.ID)
	assert.Equal(t, entry.MaintenanceItemID, got.MaintenanceItemID)
	assert.Equal(t, entry.Notes, got.Notes)
}

func TestListMaintenanceServiceLogsReturnsEntries(t *testing.T) {
	t.Parallel()

	h, store := newTestServerWithStore(t, false)
	vendor := createVendorFixture(t, store)
	appliance := createApplianceFixture(t, store)
	item := createMaintenanceFixture(t, store, &appliance.ID)
	entry := createServiceLogFixture(t, store, item.ID, vendor)

	req := httptest.NewRequest(http.MethodGet, "/api/maintenance/"+item.ID+"/service-logs", nil)
	rec := httptest.NewRecorder()

	h.ServeHTTP(rec, req)

	require.Equal(t, http.StatusOK, rec.Code)
	var entries []data.ServiceLogEntry
	require.NoError(t, json.NewDecoder(rec.Body).Decode(&entries))
	require.Len(t, entries, 1)
	assert.Equal(t, entry.ID, entries[0].ID)
}

func TestPostServiceLogCreatesServiceLog(t *testing.T) {
	t.Parallel()

	h, store := newTestServerWithStore(t, false)
	vendor := createVendorFixture(t, store)
	appliance := createApplianceFixture(t, store)
	item := createMaintenanceFixture(t, store, &appliance.ID)
	body := data.ServiceLogEntry{
		ServicedAt: time.Date(2026, time.April, 26, 10, 0, 0, 0, time.UTC),
		VendorID:   &vendor.ID,
		CostCents:  int64Ptr(12500),
		Notes:      "Spring inspection completed",
	}
	req := jsonRequest(t, http.MethodPost, "/api/maintenance/"+item.ID+"/service-logs", body)
	rec := httptest.NewRecorder()

	h.ServeHTTP(rec, req)

	require.Equal(t, http.StatusCreated, rec.Code)
	var got data.ServiceLogEntry
	require.NoError(t, json.NewDecoder(rec.Body).Decode(&got))
	assert.NotEmpty(t, got.ID)
	assert.Equal(t, item.ID, got.MaintenanceItemID)
	assert.Equal(t, body.Notes, got.Notes)
}

func TestPutServiceLogUpdatesServiceLog(t *testing.T) {
	t.Parallel()

	h, store := newTestServerWithStore(t, false)
	vendor := createVendorFixture(t, store)
	appliance := createApplianceFixture(t, store)
	item := createMaintenanceFixture(t, store, &appliance.ID)
	entry := createServiceLogFixture(t, store, item.ID, vendor)
	entry.CostCents = int64Ptr(15000)
	entry.Notes = "Updated service visit notes"

	req := jsonRequest(t, http.MethodPut, "/api/service-logs/"+entry.ID, entry)
	rec := httptest.NewRecorder()

	h.ServeHTTP(rec, req)

	require.Equal(t, http.StatusOK, rec.Code)
	var got data.ServiceLogEntry
	require.NoError(t, json.NewDecoder(rec.Body).Decode(&got))
	assert.Equal(t, entry.ID, got.ID)
	assert.Equal(t, entry.Notes, got.Notes)
	require.NotNil(t, got.CostCents)
	assert.Equal(t, *entry.CostCents, *got.CostCents)
}

func TestDeleteServiceLogSoftDeletesServiceLog(t *testing.T) {
	t.Parallel()

	h, store := newTestServerWithStore(t, false)
	vendor := createVendorFixture(t, store)
	appliance := createApplianceFixture(t, store)
	item := createMaintenanceFixture(t, store, &appliance.ID)
	entry := createServiceLogFixture(t, store, item.ID, vendor)

	req := httptest.NewRequest(http.MethodDelete, "/api/service-logs/"+entry.ID, nil)
	rec := httptest.NewRecorder()

	h.ServeHTTP(rec, req)

	require.Equal(t, http.StatusNoContent, rec.Code)
	entries, err := store.ListServiceLog(item.ID, false)
	require.NoError(t, err)
	assert.Empty(t, entries)
}

func TestTrashListsUnrestoredDeletions(t *testing.T) {
	t.Parallel()

	h, store := newTestServerWithStore(t, false)
	project := createProjectFixture(t, store)
	require.NoError(t, store.DeleteProject(project.ID))

	req := httptest.NewRequest(http.MethodGet, "/api/trash", nil)
	rec := httptest.NewRecorder()

	h.ServeHTTP(rec, req)

	require.Equal(t, http.StatusOK, rec.Code)
	var items []struct {
		Entity      string    `json:"entity"`
		EntityLabel string    `json:"entity_label"`
		TargetID    string    `json:"target_id"`
		Label       string    `json:"label"`
		DeletedAt   time.Time `json:"deleted_at"`
	}
	require.NoError(t, json.NewDecoder(rec.Body).Decode(&items))
	require.NotEmpty(t, items)
	assert.Equal(t, data.DeletionEntityProject, items[0].Entity)
	assert.Equal(t, project.ID, items[0].TargetID)
	assert.Contains(t, items[0].Label, project.Title)
	assert.Equal(t, "Project", items[0].EntityLabel)
	assert.False(t, items[0].DeletedAt.IsZero())
}

func TestTrashRestoreRestoresDeletedProject(t *testing.T) {
	t.Parallel()

	h, store := newTestServerWithStore(t, false)
	project := createProjectFixture(t, store)
	require.NoError(t, store.DeleteProject(project.ID))

	req := httptest.NewRequest(http.MethodPost, "/api/trash/project/"+project.ID+"/restore", nil)
	rec := httptest.NewRecorder()

	h.ServeHTTP(rec, req)

	require.Equal(t, http.StatusNoContent, rec.Code)
	projects, err := store.ListProjects(false)
	require.NoError(t, err)
	require.Len(t, projects, 1)
	assert.Equal(t, project.ID, projects[0].ID)
}

func jsonRequest(t *testing.T, method, path string, body any) *http.Request {
	t.Helper()

	payload, err := json.Marshal(body)
	require.NoError(t, err)
	req := httptest.NewRequest(method, path, bytes.NewReader(payload))
	req.Header.Set("Content-Type", "application/json")
	return req
}

func firstProjectTypeID(t *testing.T, store *data.Store) string {
	t.Helper()

	types, err := store.ProjectTypes()
	require.NoError(t, err)
	require.NotEmpty(t, types)
	return types[0].ID
}

func createVendorFixture(t *testing.T, store *data.Store) data.Vendor {
	t.Helper()

	vendor := data.Vendor{
		Name:        "Maison Fixe",
		ContactName: "Aurore Petit",
		Email:       "aurore@maisonfixe.example",
		Phone:       "0102030405",
		Website:     "https://maisonfixe.example",
	}
	require.NoError(t, store.CreateVendor(&vendor))
	return vendor
}

func createProjectFixture(t *testing.T, store *data.Store) data.Project {
	t.Helper()

	project := data.Project{
		Title:         "Refaire la terrasse",
		ProjectTypeID: firstProjectTypeID(t, store),
		Status:        data.ProjectStatusPlanned,
		Description:   "Bois composite et nouvelle structure",
	}
	require.NoError(t, store.CreateProject(&project))
	return project
}

func createQuoteFixture(t *testing.T, store *data.Store, projectID string, vendor data.Vendor) data.Quote {
	t.Helper()

	quote := data.Quote{
		ProjectID:      projectID,
		VendorID:       vendor.ID,
		TotalCents:     99000,
		LaborCents:     int64Ptr(50000),
		MaterialsCents: int64Ptr(49000),
		Notes:          "Initial quote",
	}
	require.NoError(t, store.CreateQuote(&quote, vendor))
	return quote
}

func createApplianceFixture(t *testing.T, store *data.Store) data.Appliance {
	t.Helper()

	appliance := data.Appliance{
		Name:         "Condensing Boiler",
		Brand:        "Bosco",
		ModelNumber:  "CB-42",
		SerialNumber: "SER-9988",
		Location:     "Basement",
		CostCents:    int64Ptr(275000),
		Notes:        "Annual service contract",
	}
	require.NoError(t, store.CreateAppliance(&appliance))
	return appliance
}

func createMaintenanceFixture(t *testing.T, store *data.Store, applianceID *string) data.MaintenanceItem {
	t.Helper()

	item := data.MaintenanceItem{
		Name:           "Flush condensate line",
		CategoryID:     firstMaintenanceCategoryID(t, store),
		ApplianceID:    applianceID,
		Season:         data.SeasonSpring,
		IntervalMonths: 12,
		Notes:          "Check trap and clear sediment",
		CostCents:      int64Ptr(6500),
	}
	require.NoError(t, store.CreateMaintenance(&item))
	return item
}

func createIncidentFixture(t *testing.T, store *data.Store, applianceID, vendorID *string) data.Incident {
	t.Helper()

	incident := data.Incident{
		Title:       "Roof leak",
		Description: "Water mark near the skylight.",
		Status:      data.IncidentStatusOpen,
		Severity:    data.IncidentSeverityUrgent,
		DateNoticed: mustTime("2026-04-24T09:30:00Z"),
		Location:    "Attic",
		CostCents:   int64Ptr(15500),
		ApplianceID: applianceID,
		VendorID:    vendorID,
		Notes:       "Temporary bucket in place",
	}
	require.NoError(t, store.CreateIncident(&incident))
	return incident
}

func createDocumentFixture(t *testing.T, store *data.Store, entityKind, entityID string) data.Document {
	t.Helper()

	doc := data.Document{
		Title:          "Leak photo",
		FileName:       "leak-photo.txt",
		EntityKind:     entityKind,
		EntityID:       entityID,
		MIMEType:       "text/plain",
		SizeBytes:      int64(len("leak evidence")),
		ChecksumSHA256: "checksum-placeholder",
		Data:           []byte("leak evidence"),
		Notes:          "Created by test",
	}
	require.NoError(t, store.CreateDocument(&doc))
	return doc
}

func createServiceLogFixture(t *testing.T, store *data.Store, maintenanceID string, vendor data.Vendor) data.ServiceLogEntry {
	t.Helper()

	entry := data.ServiceLogEntry{
		MaintenanceItemID: maintenanceID,
		ServicedAt:        time.Date(2026, time.April, 20, 14, 0, 0, 0, time.UTC),
		CostCents:         int64Ptr(9900),
		Notes:             "Initial service visit",
	}
	require.NoError(t, store.CreateServiceLog(&entry, vendor))
	return entry
}

type multipartDocumentPayload struct {
	Title      string
	EntityKind string
	EntityID   string
	Notes      string
	FileName   string
	MIMEType   string
	Content    []byte
}

func multipartDocumentRequest(t *testing.T, path string, payload multipartDocumentPayload) *http.Request {
	t.Helper()

	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)
	for key, value := range map[string]string{
		"title":      payload.Title,
		"entityKind": payload.EntityKind,
		"entityId":   payload.EntityID,
		"notes":      payload.Notes,
	} {
		if value == "" {
			continue
		}
		require.NoError(t, writer.WriteField(key, value))
	}
	part, err := writer.CreateFormFile("file", payload.FileName)
	require.NoError(t, err)
	_, err = part.Write(payload.Content)
	require.NoError(t, err)
	require.NoError(t, writer.Close())

	req := httptest.NewRequest(http.MethodPost, path, body)
	req.Header.Set("Content-Type", writer.FormDataContentType())
	return req
}

func firstMaintenanceCategoryID(t *testing.T, store *data.Store) string {
	t.Helper()

	categories, err := store.MaintenanceCategories()
	require.NoError(t, err)
	require.NotEmpty(t, categories)
	return categories[0].ID
}

func int64Ptr(value int64) *int64 {
	return &value
}

func timePtrRFC3339(value string) *time.Time {
	timeValue, err := time.Parse(time.RFC3339, value)
	if err != nil {
		panic(err)
	}
	return &timeValue
}

func mustTime(value string) time.Time {
	parsed, err := time.Parse(time.RFC3339, value)
	if err != nil {
		panic(err)
	}
	return parsed
}
