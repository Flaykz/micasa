// Copyright 2026 Phillip Cloud
// Licensed under the Apache License, Version 2.0

package web

import (
	"crypto/sha256"
	"embed"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"net/http"
	"path"
	"path/filepath"
	"strings"
	"time"

	"github.com/micasa-dev/micasa/internal/config"
	"github.com/micasa-dev/micasa/internal/data"
	"gorm.io/gorm"
)

//go:embed all:dist
var staticFS embed.FS

type Server struct {
	store      *data.Store
	handler    http.Handler
	loadConfig func() (config.Config, error)
}

type dashboardResponse struct {
	Incidents          []data.Incident        `json:"incidents"`
	Maintenance        []data.MaintenanceItem `json:"maintenance"`
	ActiveProjects     []data.Project         `json:"active_projects"`
	ExpiringWarranties []data.Appliance       `json:"expiring_warranties"`
	House              *data.HouseProfile     `json:"house,omitempty"`
	RecentServiceLogs  []data.ServiceLogEntry `json:"recent_service_logs"`
	YTDServiceSpend    int64                  `json:"ytd_service_spend_cents"`
	TotalProjectSpend  int64                  `json:"total_project_spend_cents"`
	CurrencyCode       string                 `json:"currency_code"`
}

const maxBodySize = 1 << 20

func NewServer(store *data.Store) *Server {
	mux := http.NewServeMux()
	server := &Server{store: store}

	mux.HandleFunc("GET /api/house", server.getHouse)
	mux.HandleFunc("PUT /api/house", server.putHouse)
	mux.HandleFunc("GET /api/settings", server.getSettings)
	mux.HandleFunc("PUT /api/settings", server.putSettings)
	mux.HandleFunc("GET /api/dashboard", server.getDashboard)
	mux.HandleFunc("GET /api/project-types", server.listProjectTypes)
	mux.HandleFunc("GET /api/maintenance-categories", server.listMaintenanceCategories)
	mux.HandleFunc("GET /api/projects", server.listProjects)
	mux.HandleFunc("POST /api/projects", server.createProject)
	mux.HandleFunc("GET /api/projects/{id}", server.getProject)
	mux.HandleFunc("GET /api/projects/{id}/quotes", server.listProjectQuotes)
	mux.HandleFunc("PUT /api/projects/{id}", server.updateProject)
	mux.HandleFunc("DELETE /api/projects/{id}", server.deleteProject)
	mux.HandleFunc("GET /api/quotes", server.listQuotes)
	mux.HandleFunc("POST /api/quotes", server.createQuote)
	mux.HandleFunc("GET /api/quotes/{id}", server.getQuote)
	mux.HandleFunc("PUT /api/quotes/{id}", server.updateQuote)
	mux.HandleFunc("DELETE /api/quotes/{id}", server.deleteQuote)
	mux.HandleFunc("GET /api/vendors", server.listVendors)
	mux.HandleFunc("POST /api/vendors", server.createVendor)
	mux.HandleFunc("GET /api/vendors/{id}", server.getVendor)
	mux.HandleFunc("PUT /api/vendors/{id}", server.updateVendor)
	mux.HandleFunc("DELETE /api/vendors/{id}", server.deleteVendor)
	mux.HandleFunc("GET /api/maintenance", server.listMaintenance)
	mux.HandleFunc("POST /api/maintenance", server.createMaintenance)
	mux.HandleFunc("GET /api/maintenance/{id}", server.getMaintenance)
	mux.HandleFunc("GET /api/maintenance/{id}/service-logs", server.listMaintenanceServiceLogs)
	mux.HandleFunc("POST /api/maintenance/{id}/service-logs", server.createServiceLog)
	mux.HandleFunc("PUT /api/maintenance/{id}", server.updateMaintenance)
	mux.HandleFunc("DELETE /api/maintenance/{id}", server.deleteMaintenance)
	mux.HandleFunc("GET /api/appliances", server.listAppliances)
	mux.HandleFunc("POST /api/appliances", server.createAppliance)
	mux.HandleFunc("GET /api/appliances/{id}", server.getAppliance)
	mux.HandleFunc("GET /api/appliances/{id}/maintenance", server.listApplianceMaintenance)
	mux.HandleFunc("PUT /api/appliances/{id}", server.updateAppliance)
	mux.HandleFunc("DELETE /api/appliances/{id}", server.deleteAppliance)
	mux.HandleFunc("GET /api/incidents", server.listIncidents)
	mux.HandleFunc("POST /api/incidents", server.createIncident)
	mux.HandleFunc("GET /api/incidents/{id}", server.getIncident)
	mux.HandleFunc("PUT /api/incidents/{id}", server.updateIncident)
	mux.HandleFunc("DELETE /api/incidents/{id}", server.deleteIncident)
	mux.HandleFunc("GET /api/documents", server.listDocuments)
	mux.HandleFunc("POST /api/documents", server.createDocument)
	mux.HandleFunc("GET /api/documents/{id}", server.getDocument)
	mux.HandleFunc("GET /api/documents/{id}/download", server.downloadDocument)
	mux.HandleFunc("PUT /api/documents/{id}", server.updateDocument)
	mux.HandleFunc("DELETE /api/documents/{id}", server.deleteDocument)
	mux.HandleFunc("GET /api/service-logs", server.listServiceLogs)
	mux.HandleFunc("GET /api/service-logs/{id}", server.getServiceLog)
	mux.HandleFunc("PUT /api/service-logs/{id}", server.updateServiceLog)
	mux.HandleFunc("DELETE /api/service-logs/{id}", server.deleteServiceLog)
	mux.HandleFunc("GET /api/trash", server.listTrash)
	mux.HandleFunc("POST /api/trash/{entity}/{id}/restore", server.restoreTrash)
	mux.Handle("/", newSPAHandler(mustDistSubFS()))

	server.handler = mux
	server.loadConfig = config.Load
	return server
}

func (s *Server) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	s.handler.ServeHTTP(w, r)
}

func mustDistSubFS() fs.FS {
	sub, err := fs.Sub(staticFS, "dist")
	if err != nil {
		panic(fmt.Sprintf("web static fs: %v", err))
	}
	return sub
}

type spaHandler struct {
	fs         fs.FS
	fileServer http.Handler
}

func newSPAHandler(frontend fs.FS) http.Handler {
	return spaHandler{
		fs:         frontend,
		fileServer: http.FileServerFS(frontend),
	}
}

func (h spaHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	clean := strings.TrimPrefix(path.Clean(r.URL.Path), "/")
	if clean == "." || clean == "" {
		h.serveIndex(w, r)
		return
	}

	if fileExists(h.fs, clean) {
		h.fileServer.ServeHTTP(w, r)
		return
	}

	if strings.Contains(path.Base(clean), ".") {
		h.fileServer.ServeHTTP(w, r)
		return
	}

	h.serveIndex(w, r)
}

func (h spaHandler) serveIndex(w http.ResponseWriter, r *http.Request) {
	http.ServeFileFS(w, r, h.fs, "index.html")
}

func fileExists(frontend fs.FS, name string) bool {
	info, err := fs.Stat(frontend, name)
	if err != nil {
		return false
	}
	return !info.IsDir()
}

func (s *Server) getHouse(w http.ResponseWriter, _ *http.Request) {
	house, err := s.store.HouseProfile()
	if errors.Is(err, gorm.ErrRecordNotFound) {
		jsonOK(w, map[string]any{})
		return
	}
	if err != nil {
		jsonError(w, http.StatusInternalServerError, err)
		return
	}
	jsonOK(w, house)
}

func (s *Server) putHouse(w http.ResponseWriter, r *http.Request) {
	body, err := decodeBody[data.HouseProfile](r)
	if err != nil {
		jsonError(w, http.StatusBadRequest, err)
		return
	}

	_, getErr := s.store.HouseProfile()
	if errors.Is(getErr, gorm.ErrRecordNotFound) {
		if err := s.store.CreateHouseProfile(body); err != nil {
			jsonError(w, http.StatusInternalServerError, err)
			return
		}
	} else if getErr != nil {
		jsonError(w, http.StatusInternalServerError, getErr)
		return
	} else {
		if err := s.store.UpdateHouseProfile(body); err != nil {
			jsonError(w, http.StatusInternalServerError, err)
			return
		}
	}

	profile, err := s.store.HouseProfile()
	if err != nil {
		jsonError(w, http.StatusInternalServerError, err)
		return
	}
	jsonOK(w, profile)
}

func (s *Server) getDashboard(w http.ResponseWriter, _ *http.Request) {
	now := time.Now()
	incidents, err := s.store.ListOpenIncidents()
	if err != nil {
		jsonError(w, http.StatusInternalServerError, err)
		return
	}
	maintenance, err := s.store.ListMaintenanceWithSchedule()
	if err != nil {
		jsonError(w, http.StatusInternalServerError, err)
		return
	}
	projects, err := s.store.ListActiveProjects()
	if err != nil {
		jsonError(w, http.StatusInternalServerError, err)
		return
	}
	warranties, err := s.store.ListExpiringWarranties(now, 30*24*time.Hour, 90*24*time.Hour)
	if err != nil {
		jsonError(w, http.StatusInternalServerError, err)
		return
	}
	recentLogs, err := s.store.ListRecentServiceLogs(5)
	if err != nil {
		jsonError(w, http.StatusInternalServerError, err)
		return
	}
	yearStart := time.Date(now.Year(), 1, 1, 0, 0, 0, 0, now.Location())
	ytdSpend, err := s.store.YTDServiceSpendCents(yearStart)
	if err != nil {
		jsonError(w, http.StatusInternalServerError, err)
		return
	}
	totalProjectSpend, err := s.store.TotalProjectSpendCents()
	if err != nil {
		jsonError(w, http.StatusInternalServerError, err)
		return
	}

	var house *data.HouseProfile
	profile, err := s.store.HouseProfile()
	if err == nil {
		house = &profile
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		jsonError(w, http.StatusInternalServerError, err)
		return
	}

	currencyCode := s.store.Currency().Code()
	if currencyCode == "" {
		currencyCode = "USD"
	}

	jsonOK(w, dashboardResponse{
		Incidents:          ensureSlice(incidents),
		Maintenance:        ensureSlice(maintenance),
		ActiveProjects:     ensureSlice(projects),
		ExpiringWarranties: ensureSlice(warranties),
		House:              house,
		RecentServiceLogs:  ensureSlice(recentLogs),
		YTDServiceSpend:    ytdSpend,
		TotalProjectSpend:  totalProjectSpend,
		CurrencyCode:       currencyCode,
	})
}

func (s *Server) listProjectTypes(w http.ResponseWriter, _ *http.Request) {
	items, err := s.store.ProjectTypes()
	if err != nil {
		jsonError(w, http.StatusInternalServerError, err)
		return
	}
	jsonOK(w, items)
}

func (s *Server) listMaintenanceCategories(w http.ResponseWriter, _ *http.Request) {
	items, err := s.store.MaintenanceCategories()
	if err != nil {
		jsonError(w, http.StatusInternalServerError, err)
		return
	}
	jsonOK(w, items)
}

func (s *Server) listProjects(w http.ResponseWriter, r *http.Request) {
	items, err := s.store.ListProjects(boolQuery(r, "include_deleted"))
	if err != nil {
		jsonError(w, http.StatusInternalServerError, err)
		return
	}
	jsonOK(w, items)
}

func (s *Server) getProject(w http.ResponseWriter, r *http.Request) {
	id, err := pathID(r)
	if err != nil {
		jsonError(w, http.StatusBadRequest, err)
		return
	}
	project, err := s.store.GetProject(id)
	if errors.Is(err, gorm.ErrRecordNotFound) {
		jsonError(w, http.StatusNotFound, fmt.Errorf("project not found"))
		return
	}
	if err != nil {
		jsonError(w, http.StatusInternalServerError, err)
		return
	}
	jsonOK(w, project)
}

func (s *Server) createProject(w http.ResponseWriter, r *http.Request) {
	body, err := decodeBody[data.Project](r)
	if err != nil {
		jsonError(w, http.StatusBadRequest, err)
		return
	}
	if err := s.store.CreateProject(&body); err != nil {
		jsonError(w, http.StatusInternalServerError, err)
		return
	}
	jsonCreated(w, body)
}

func (s *Server) updateProject(w http.ResponseWriter, r *http.Request) {
	id, err := pathID(r)
	if err != nil {
		jsonError(w, http.StatusBadRequest, err)
		return
	}
	body, err := decodeBody[data.Project](r)
	if err != nil {
		jsonError(w, http.StatusBadRequest, err)
		return
	}
	body.ID = id
	if err := s.store.UpdateProject(body); err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			jsonError(w, http.StatusNotFound, fmt.Errorf("project not found"))
			return
		}
		jsonError(w, http.StatusInternalServerError, err)
		return
	}
	project, err := s.store.GetProject(id)
	if err != nil {
		jsonError(w, http.StatusInternalServerError, err)
		return
	}
	jsonOK(w, project)
}

func (s *Server) deleteProject(w http.ResponseWriter, r *http.Request) {
	id, err := pathID(r)
	if err != nil {
		jsonError(w, http.StatusBadRequest, err)
		return
	}
	if err := s.store.DeleteProject(id); err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			jsonError(w, http.StatusNotFound, fmt.Errorf("project not found"))
			return
		}
		jsonError(w, http.StatusConflict, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) listProjectQuotes(w http.ResponseWriter, r *http.Request) {
	id, err := pathID(r)
	if err != nil {
		jsonError(w, http.StatusBadRequest, err)
		return
	}
	quotes, err := s.store.ListQuotesByProject(id, boolQuery(r, "include_deleted"))
	if err != nil {
		jsonError(w, http.StatusInternalServerError, err)
		return
	}
	jsonOK(w, quotes)
}

func (s *Server) listQuotes(w http.ResponseWriter, r *http.Request) {
	items, err := s.store.ListQuotes(boolQuery(r, "include_deleted"))
	if err != nil {
		jsonError(w, http.StatusInternalServerError, err)
		return
	}
	jsonOK(w, items)
}

func (s *Server) getQuote(w http.ResponseWriter, r *http.Request) {
	id, err := pathID(r)
	if err != nil {
		jsonError(w, http.StatusBadRequest, err)
		return
	}
	quote, err := s.store.GetQuote(id)
	if errors.Is(err, gorm.ErrRecordNotFound) {
		jsonError(w, http.StatusNotFound, fmt.Errorf("quote not found"))
		return
	}
	if err != nil {
		jsonError(w, http.StatusInternalServerError, err)
		return
	}
	jsonOK(w, quote)
}

func (s *Server) createQuote(w http.ResponseWriter, r *http.Request) {
	body, err := decodeBody[data.Quote](r)
	if err != nil {
		jsonError(w, http.StatusBadRequest, err)
		return
	}
	vendor, err := s.store.GetVendor(body.VendorID)
	if errors.Is(err, gorm.ErrRecordNotFound) {
		jsonError(w, http.StatusNotFound, fmt.Errorf("vendor not found"))
		return
	}
	if err != nil {
		jsonError(w, http.StatusInternalServerError, err)
		return
	}
	if err := s.store.CreateQuote(&body, vendor); err != nil {
		jsonError(w, http.StatusInternalServerError, err)
		return
	}
	jsonCreated(w, body)
}

func (s *Server) updateQuote(w http.ResponseWriter, r *http.Request) {
	id, err := pathID(r)
	if err != nil {
		jsonError(w, http.StatusBadRequest, err)
		return
	}
	body, err := decodeBody[data.Quote](r)
	if err != nil {
		jsonError(w, http.StatusBadRequest, err)
		return
	}
	vendor, err := s.store.GetVendor(body.VendorID)
	if errors.Is(err, gorm.ErrRecordNotFound) {
		jsonError(w, http.StatusNotFound, fmt.Errorf("vendor not found"))
		return
	}
	if err != nil {
		jsonError(w, http.StatusInternalServerError, err)
		return
	}
	body.ID = id
	if err := s.store.UpdateQuote(body, vendor); err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			jsonError(w, http.StatusNotFound, fmt.Errorf("quote not found"))
			return
		}
		jsonError(w, http.StatusInternalServerError, err)
		return
	}
	quote, err := s.store.GetQuote(id)
	if err != nil {
		jsonError(w, http.StatusInternalServerError, err)
		return
	}
	jsonOK(w, quote)
}

func (s *Server) deleteQuote(w http.ResponseWriter, r *http.Request) {
	id, err := pathID(r)
	if err != nil {
		jsonError(w, http.StatusBadRequest, err)
		return
	}
	if err := s.store.DeleteQuote(id); err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			jsonError(w, http.StatusNotFound, fmt.Errorf("quote not found"))
			return
		}
		jsonError(w, http.StatusConflict, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) listVendors(w http.ResponseWriter, r *http.Request) {
	items, err := s.store.ListVendors(boolQuery(r, "include_deleted"))
	if err != nil {
		jsonError(w, http.StatusInternalServerError, err)
		return
	}
	jsonOK(w, items)
}

func (s *Server) getVendor(w http.ResponseWriter, r *http.Request) {
	id, err := pathID(r)
	if err != nil {
		jsonError(w, http.StatusBadRequest, err)
		return
	}
	vendor, err := s.store.GetVendor(id)
	if errors.Is(err, gorm.ErrRecordNotFound) {
		jsonError(w, http.StatusNotFound, fmt.Errorf("vendor not found"))
		return
	}
	if err != nil {
		jsonError(w, http.StatusInternalServerError, err)
		return
	}
	jsonOK(w, vendor)
}

func (s *Server) createVendor(w http.ResponseWriter, r *http.Request) {
	body, err := decodeBody[data.Vendor](r)
	if err != nil {
		jsonError(w, http.StatusBadRequest, err)
		return
	}
	if err := s.store.CreateVendor(&body); err != nil {
		jsonError(w, http.StatusInternalServerError, err)
		return
	}
	jsonCreated(w, body)
}

func (s *Server) updateVendor(w http.ResponseWriter, r *http.Request) {
	id, err := pathID(r)
	if err != nil {
		jsonError(w, http.StatusBadRequest, err)
		return
	}
	body, err := decodeBody[data.Vendor](r)
	if err != nil {
		jsonError(w, http.StatusBadRequest, err)
		return
	}
	body.ID = id
	if err := s.store.UpdateVendor(body); err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			jsonError(w, http.StatusNotFound, fmt.Errorf("vendor not found"))
			return
		}
		jsonError(w, http.StatusInternalServerError, err)
		return
	}
	vendor, err := s.store.GetVendor(id)
	if err != nil {
		jsonError(w, http.StatusInternalServerError, err)
		return
	}
	jsonOK(w, vendor)
}

func (s *Server) deleteVendor(w http.ResponseWriter, r *http.Request) {
	id, err := pathID(r)
	if err != nil {
		jsonError(w, http.StatusBadRequest, err)
		return
	}
	if err := s.store.DeleteVendor(id); err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			jsonError(w, http.StatusNotFound, fmt.Errorf("vendor not found"))
			return
		}
		jsonError(w, http.StatusConflict, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) listMaintenance(w http.ResponseWriter, r *http.Request) {
	items, err := s.store.ListMaintenance(boolQuery(r, "include_deleted"))
	if err != nil {
		jsonError(w, http.StatusInternalServerError, err)
		return
	}
	jsonOK(w, items)
}

func (s *Server) getMaintenance(w http.ResponseWriter, r *http.Request) {
	id, err := pathID(r)
	if err != nil {
		jsonError(w, http.StatusBadRequest, err)
		return
	}
	item, err := s.store.GetMaintenance(id)
	if errors.Is(err, gorm.ErrRecordNotFound) {
		jsonError(w, http.StatusNotFound, fmt.Errorf("maintenance item not found"))
		return
	}
	if err != nil {
		jsonError(w, http.StatusInternalServerError, err)
		return
	}
	jsonOK(w, item)
}

func (s *Server) listMaintenanceServiceLogs(w http.ResponseWriter, r *http.Request) {
	id, err := pathID(r)
	if err != nil {
		jsonError(w, http.StatusBadRequest, err)
		return
	}
	items, err := s.store.ListServiceLog(id, boolQuery(r, "include_deleted"))
	if err != nil {
		jsonError(w, http.StatusInternalServerError, err)
		return
	}
	jsonOK(w, items)
}

func (s *Server) createMaintenance(w http.ResponseWriter, r *http.Request) {
	body, err := decodeBody[data.MaintenanceItem](r)
	if err != nil {
		jsonError(w, http.StatusBadRequest, err)
		return
	}
	if err := s.store.CreateMaintenance(&body); err != nil {
		jsonError(w, http.StatusInternalServerError, err)
		return
	}
	jsonCreated(w, body)
}

func (s *Server) updateMaintenance(w http.ResponseWriter, r *http.Request) {
	id, err := pathID(r)
	if err != nil {
		jsonError(w, http.StatusBadRequest, err)
		return
	}
	body, err := decodeBody[data.MaintenanceItem](r)
	if err != nil {
		jsonError(w, http.StatusBadRequest, err)
		return
	}
	body.ID = id
	if err := s.store.UpdateMaintenance(body); err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			jsonError(w, http.StatusNotFound, fmt.Errorf("maintenance item not found"))
			return
		}
		jsonError(w, http.StatusInternalServerError, err)
		return
	}
	item, err := s.store.GetMaintenance(id)
	if err != nil {
		jsonError(w, http.StatusInternalServerError, err)
		return
	}
	jsonOK(w, item)
}

func (s *Server) deleteMaintenance(w http.ResponseWriter, r *http.Request) {
	id, err := pathID(r)
	if err != nil {
		jsonError(w, http.StatusBadRequest, err)
		return
	}
	if err := s.store.DeleteMaintenance(id); err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			jsonError(w, http.StatusNotFound, fmt.Errorf("maintenance item not found"))
			return
		}
		jsonError(w, http.StatusConflict, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) listAppliances(w http.ResponseWriter, r *http.Request) {
	items, err := s.store.ListAppliances(boolQuery(r, "include_deleted"))
	if err != nil {
		jsonError(w, http.StatusInternalServerError, err)
		return
	}
	jsonOK(w, items)
}

func (s *Server) getAppliance(w http.ResponseWriter, r *http.Request) {
	id, err := pathID(r)
	if err != nil {
		jsonError(w, http.StatusBadRequest, err)
		return
	}
	item, err := s.store.GetAppliance(id)
	if errors.Is(err, gorm.ErrRecordNotFound) {
		jsonError(w, http.StatusNotFound, fmt.Errorf("appliance not found"))
		return
	}
	if err != nil {
		jsonError(w, http.StatusInternalServerError, err)
		return
	}
	jsonOK(w, item)
}

func (s *Server) listApplianceMaintenance(w http.ResponseWriter, r *http.Request) {
	id, err := pathID(r)
	if err != nil {
		jsonError(w, http.StatusBadRequest, err)
		return
	}
	items, err := s.store.ListMaintenanceByAppliance(id, boolQuery(r, "include_deleted"))
	if err != nil {
		jsonError(w, http.StatusInternalServerError, err)
		return
	}
	jsonOK(w, items)
}

func (s *Server) createAppliance(w http.ResponseWriter, r *http.Request) {
	body, err := decodeBody[data.Appliance](r)
	if err != nil {
		jsonError(w, http.StatusBadRequest, err)
		return
	}
	if err := s.store.CreateAppliance(&body); err != nil {
		jsonError(w, http.StatusInternalServerError, err)
		return
	}
	jsonCreated(w, body)
}

func (s *Server) updateAppliance(w http.ResponseWriter, r *http.Request) {
	id, err := pathID(r)
	if err != nil {
		jsonError(w, http.StatusBadRequest, err)
		return
	}
	body, err := decodeBody[data.Appliance](r)
	if err != nil {
		jsonError(w, http.StatusBadRequest, err)
		return
	}
	body.ID = id
	if err := s.store.UpdateAppliance(body); err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			jsonError(w, http.StatusNotFound, fmt.Errorf("appliance not found"))
			return
		}
		jsonError(w, http.StatusInternalServerError, err)
		return
	}
	item, err := s.store.GetAppliance(id)
	if err != nil {
		jsonError(w, http.StatusInternalServerError, err)
		return
	}
	jsonOK(w, item)
}

func (s *Server) deleteAppliance(w http.ResponseWriter, r *http.Request) {
	id, err := pathID(r)
	if err != nil {
		jsonError(w, http.StatusBadRequest, err)
		return
	}
	if err := s.store.DeleteAppliance(id); err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			jsonError(w, http.StatusNotFound, fmt.Errorf("appliance not found"))
			return
		}
		jsonError(w, http.StatusConflict, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) listIncidents(w http.ResponseWriter, r *http.Request) {
	items, err := s.store.ListIncidents(boolQuery(r, "include_deleted"))
	if err != nil {
		jsonError(w, http.StatusInternalServerError, err)
		return
	}
	jsonOK(w, items)
}

func (s *Server) getIncident(w http.ResponseWriter, r *http.Request) {
	id, err := pathID(r)
	if err != nil {
		jsonError(w, http.StatusBadRequest, err)
		return
	}
	item, err := s.store.GetIncident(id)
	if errors.Is(err, gorm.ErrRecordNotFound) {
		jsonError(w, http.StatusNotFound, fmt.Errorf("incident not found"))
		return
	}
	if err != nil {
		jsonError(w, http.StatusInternalServerError, err)
		return
	}
	jsonOK(w, item)
}

func (s *Server) createIncident(w http.ResponseWriter, r *http.Request) {
	body, err := decodeBody[data.Incident](r)
	if err != nil {
		jsonError(w, http.StatusBadRequest, err)
		return
	}
	if err := s.store.CreateIncident(&body); err != nil {
		jsonError(w, http.StatusInternalServerError, err)
		return
	}
	jsonCreated(w, body)
}

func (s *Server) updateIncident(w http.ResponseWriter, r *http.Request) {
	id, err := pathID(r)
	if err != nil {
		jsonError(w, http.StatusBadRequest, err)
		return
	}
	body, err := decodeBody[data.Incident](r)
	if err != nil {
		jsonError(w, http.StatusBadRequest, err)
		return
	}
	body.ID = id
	if err := s.store.UpdateIncident(body); err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			jsonError(w, http.StatusNotFound, fmt.Errorf("incident not found"))
			return
		}
		jsonError(w, http.StatusInternalServerError, err)
		return
	}
	item, err := s.store.GetIncident(id)
	if err != nil {
		jsonError(w, http.StatusInternalServerError, err)
		return
	}
	jsonOK(w, item)
}

func (s *Server) deleteIncident(w http.ResponseWriter, r *http.Request) {
	id, err := pathID(r)
	if err != nil {
		jsonError(w, http.StatusBadRequest, err)
		return
	}
	if err := s.store.DeleteIncident(id); err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			jsonError(w, http.StatusNotFound, fmt.Errorf("incident not found"))
			return
		}
		jsonError(w, http.StatusConflict, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) listDocuments(w http.ResponseWriter, r *http.Request) {
	items, err := s.store.ListDocuments(boolQuery(r, "include_deleted"))
	if err != nil {
		jsonError(w, http.StatusInternalServerError, err)
		return
	}
	jsonOK(w, items)
}

func (s *Server) getDocument(w http.ResponseWriter, r *http.Request) {
	id, err := pathID(r)
	if err != nil {
		jsonError(w, http.StatusBadRequest, err)
		return
	}
	doc, err := s.store.GetDocumentMetadata(id)
	if errors.Is(err, gorm.ErrRecordNotFound) {
		jsonError(w, http.StatusNotFound, fmt.Errorf("document not found"))
		return
	}
	if err != nil {
		jsonError(w, http.StatusInternalServerError, err)
		return
	}
	jsonOK(w, doc)
}

func (s *Server) downloadDocument(w http.ResponseWriter, r *http.Request) {
	id, err := pathID(r)
	if err != nil {
		jsonError(w, http.StatusBadRequest, err)
		return
	}
	doc, err := s.store.GetDocument(id)
	if errors.Is(err, gorm.ErrRecordNotFound) {
		jsonError(w, http.StatusNotFound, fmt.Errorf("document not found"))
		return
	}
	if err != nil {
		jsonError(w, http.StatusInternalServerError, err)
		return
	}
	if len(doc.Data) == 0 {
		jsonError(w, http.StatusNotFound, fmt.Errorf("document has no content"))
		return
	}
	w.Header().Set("Content-Type", doc.MIMEType)
	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=%q", doc.FileName))
	w.Header().Set("Content-Length", fmt.Sprintf("%d", doc.SizeBytes))
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(doc.Data)
}

func (s *Server) createDocument(w http.ResponseWriter, r *http.Request) {
	maxUpload := int64(s.store.MaxDocumentSize())
	r.Body = http.MaxBytesReader(w, r.Body, maxUpload+1024)
	if err := r.ParseMultipartForm(maxUpload); err != nil {
		jsonError(w, http.StatusBadRequest, fmt.Errorf("parse form: %w", err))
		return
	}

	file, header, err := r.FormFile("file")
	if err != nil {
		jsonError(w, http.StatusBadRequest, fmt.Errorf("missing file field"))
		return
	}
	defer func() { _ = file.Close() }()

	fileData, err := io.ReadAll(file)
	if err != nil {
		jsonError(w, http.StatusInternalServerError, fmt.Errorf("read uploaded file: %w", err))
		return
	}

	title := strings.TrimSpace(r.FormValue("title"))
	if title == "" {
		title = data.TitleFromFilename(header.Filename)
	}
	mimeType := header.Header.Get("Content-Type")
	if mimeType == "" || mimeType == "application/octet-stream" {
		mimeType = detectMIME(fileData, header.Filename)
	}
	entityKind := strings.TrimSpace(r.FormValue("entityKind"))
	entityID := strings.TrimSpace(r.FormValue("entityId"))
	if (entityKind == "") != (entityID == "") {
		jsonError(w, http.StatusBadRequest, fmt.Errorf("entityKind and entityId must be provided together"))
		return
	}

	doc := data.Document{
		Title:          title,
		FileName:       filepath.Base(header.Filename),
		EntityKind:     entityKind,
		EntityID:       entityID,
		MIMEType:       mimeType,
		SizeBytes:      int64(len(fileData)),
		ChecksumSHA256: fmt.Sprintf("%x", sha256.Sum256(fileData)),
		Data:           fileData,
		Notes:          strings.TrimSpace(r.FormValue("notes")),
	}
	if err := s.store.CreateDocument(&doc); err != nil {
		jsonError(w, http.StatusInternalServerError, err)
		return
	}
	doc.Data = nil
	jsonCreated(w, doc)
}

func (s *Server) updateDocument(w http.ResponseWriter, r *http.Request) {
	id, err := pathID(r)
	if err != nil {
		jsonError(w, http.StatusBadRequest, err)
		return
	}
	body, err := decodeBody[data.Document](r)
	if err != nil {
		jsonError(w, http.StatusBadRequest, err)
		return
	}
	body.ID = id
	if err := s.store.UpdateDocument(body); err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			jsonError(w, http.StatusNotFound, fmt.Errorf("document not found"))
			return
		}
		jsonError(w, http.StatusInternalServerError, err)
		return
	}
	updated, err := s.store.GetDocumentMetadata(id)
	if err != nil {
		jsonError(w, http.StatusInternalServerError, err)
		return
	}
	jsonOK(w, updated)
}

func (s *Server) deleteDocument(w http.ResponseWriter, r *http.Request) {
	id, err := pathID(r)
	if err != nil {
		jsonError(w, http.StatusBadRequest, err)
		return
	}
	if err := s.store.DeleteDocument(id); err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			jsonError(w, http.StatusNotFound, fmt.Errorf("document not found"))
			return
		}
		jsonError(w, http.StatusConflict, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) listServiceLogs(w http.ResponseWriter, r *http.Request) {
	items, err := s.store.ListAllServiceLogEntries(boolQuery(r, "include_deleted"))
	if err != nil {
		jsonError(w, http.StatusInternalServerError, err)
		return
	}
	jsonOK(w, items)
}

func (s *Server) getServiceLog(w http.ResponseWriter, r *http.Request) {
	id, err := pathID(r)
	if err != nil {
		jsonError(w, http.StatusBadRequest, err)
		return
	}
	entry, err := s.store.GetServiceLog(id)
	if errors.Is(err, gorm.ErrRecordNotFound) {
		jsonError(w, http.StatusNotFound, fmt.Errorf("service log not found"))
		return
	}
	if err != nil {
		jsonError(w, http.StatusInternalServerError, err)
		return
	}
	jsonOK(w, entry)
}

func (s *Server) createServiceLog(w http.ResponseWriter, r *http.Request) {
	maintenanceID, err := pathID(r)
	if err != nil {
		jsonError(w, http.StatusBadRequest, err)
		return
	}
	body, err := decodeBody[data.ServiceLogEntry](r)
	if err != nil {
		jsonError(w, http.StatusBadRequest, err)
		return
	}
	body.MaintenanceItemID = maintenanceID
	vendor, err := serviceLogVendor(s.store, body.VendorID)
	if err != nil {
		jsonError(w, http.StatusNotFound, err)
		return
	}
	if err := s.store.CreateServiceLog(&body, vendor); err != nil {
		jsonError(w, http.StatusInternalServerError, err)
		return
	}
	jsonCreated(w, body)
}

func (s *Server) updateServiceLog(w http.ResponseWriter, r *http.Request) {
	id, err := pathID(r)
	if err != nil {
		jsonError(w, http.StatusBadRequest, err)
		return
	}
	body, err := decodeBody[data.ServiceLogEntry](r)
	if err != nil {
		jsonError(w, http.StatusBadRequest, err)
		return
	}
	vendor, err := serviceLogVendor(s.store, body.VendorID)
	if err != nil {
		jsonError(w, http.StatusNotFound, err)
		return
	}
	body.ID = id
	if err := s.store.UpdateServiceLog(body, vendor); err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			jsonError(w, http.StatusNotFound, fmt.Errorf("service log not found"))
			return
		}
		jsonError(w, http.StatusInternalServerError, err)
		return
	}
	entry, err := s.store.GetServiceLog(id)
	if err != nil {
		jsonError(w, http.StatusInternalServerError, err)
		return
	}
	jsonOK(w, entry)
}

func (s *Server) deleteServiceLog(w http.ResponseWriter, r *http.Request) {
	id, err := pathID(r)
	if err != nil {
		jsonError(w, http.StatusBadRequest, err)
		return
	}
	if err := s.store.DeleteServiceLog(id); err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			jsonError(w, http.StatusNotFound, fmt.Errorf("service log not found"))
			return
		}
		jsonError(w, http.StatusConflict, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) listTrash(w http.ResponseWriter, _ *http.Request) {
	items, err := s.store.ListTrashItems()
	if err != nil {
		jsonError(w, http.StatusInternalServerError, err)
		return
	}
	jsonOK(w, items)
}

func (s *Server) restoreTrash(w http.ResponseWriter, r *http.Request) {
	entity := strings.TrimSpace(r.PathValue("entity"))
	if entity == "" {
		jsonError(w, http.StatusBadRequest, fmt.Errorf("missing entity parameter"))
		return
	}
	id, err := pathID(r)
	if err != nil {
		jsonError(w, http.StatusBadRequest, err)
		return
	}
	if err := s.store.RestoreTrashItem(entity, id); err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			jsonError(w, http.StatusNotFound, err)
			return
		}
		if errors.Is(err, data.ErrUnknownTrashEntity) {
			jsonError(w, http.StatusBadRequest, err)
			return
		}
		jsonError(w, http.StatusUnprocessableEntity, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func boolQuery(r *http.Request, key string) bool {
	value := strings.ToLower(strings.TrimSpace(r.URL.Query().Get(key)))
	return value == "1" || value == "true" || value == "yes"
}

func jsonOK(w http.ResponseWriter, payload any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(payload)
}

func jsonCreated(w http.ResponseWriter, payload any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(http.StatusCreated)
	_ = json.NewEncoder(w).Encode(payload)
}

func jsonError(w http.ResponseWriter, status int, err error) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
}

func decodeBody[T any](r *http.Request) (T, error) {
	var value T
	r.Body = http.MaxBytesReader(nil, r.Body, maxBodySize)
	if err := json.NewDecoder(r.Body).Decode(&value); err != nil {
		return value, fmt.Errorf("decode request body: %w", err)
	}
	return value, nil
}

func pathID(r *http.Request) (string, error) {
	id := strings.TrimSpace(r.PathValue("id"))
	if id == "" {
		return "", fmt.Errorf("missing id parameter")
	}
	return id, nil
}

func ensureSlice[T any](items []T) []T {
	if items == nil {
		return []T{}
	}
	return items
}

func detectMIME(dataBytes []byte, filename string) string {
	mimeType := http.DetectContentType(dataBytes)
	if mimeType != "application/octet-stream" {
		return mimeType
	}
	switch strings.ToLower(filepath.Ext(filename)) {
	case ".pdf":
		return "application/pdf"
	case ".txt":
		return "text/plain"
	case ".csv":
		return "text/csv"
	case ".json":
		return "application/json"
	case ".md":
		return "text/markdown"
	default:
		return mimeType
	}
}

func serviceLogVendor(store *data.Store, vendorID *string) (data.Vendor, error) {
	if vendorID == nil || strings.TrimSpace(*vendorID) == "" {
		return data.Vendor{}, nil
	}
	vendor, err := store.GetVendor(strings.TrimSpace(*vendorID))
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return data.Vendor{}, fmt.Errorf("vendor not found")
	}
	if err != nil {
		return data.Vendor{}, err
	}
	return vendor, nil
}
