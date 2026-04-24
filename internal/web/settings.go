// Copyright 2026 Phillip Cloud
// Licensed under the Apache License, Version 2.0

package web

import (
	"fmt"
	"net/http"
	"strings"

	"github.com/micasa-dev/micasa/internal/config"
	"github.com/micasa-dev/micasa/internal/data"
	"github.com/micasa-dev/micasa/internal/locale"
)

type settingsResponse struct {
	Shared sharedSettingsResponse `json:"shared"`
	System systemSettingsResponse `json:"system"`
}

type sharedSettingsResponse struct {
	Currency   string `json:"currency"`
	UnitSystem string `json:"unit_system"`
}

type systemSettingsResponse struct {
	AddressAutofill      bool   `json:"address_autofill"`
	DocumentsMaxFileSize string `json:"documents_max_file_size"`
	DocumentsCacheTTL    string `json:"documents_cache_ttl"`
	ChatProvider         string `json:"chat_provider"`
	ChatBaseURL          string `json:"chat_base_url"`
	ChatModel            string `json:"chat_model"`
	ChatTimeout          string `json:"chat_timeout"`
	ExtractionMaxPages   int    `json:"extraction_max_pages"`
	ExtractionOCREnabled bool   `json:"extraction_ocr_enabled"`
	ExtractionLLMEnabled bool   `json:"extraction_llm_enabled"`
}

type settingsRequest struct {
	Shared struct {
		Currency   string `json:"currency"`
		UnitSystem string `json:"unit_system"`
	} `json:"shared"`
}

func (s *Server) getSettings(w http.ResponseWriter, _ *http.Request) {
	resp, err := s.settingsPayload()
	if err != nil {
		jsonError(w, 500, err)
		return
	}
	jsonOK(w, resp)
}

func (s *Server) putSettings(w http.ResponseWriter, r *http.Request) {
	var req settingsRequest
	decoded, err := decodeBody[settingsRequest](r)
	if err != nil {
		jsonError(w, 400, err)
		return
	}
	req = decoded

	if req.Shared.Currency != "" {
		code := strings.ToUpper(strings.TrimSpace(req.Shared.Currency))
		cur, err := locale.Resolve(code, locale.DetectLocale())
		if err != nil {
			jsonError(w, 400, err)
			return
		}
		if err := s.store.PutCurrency(cur.Code()); err != nil {
			jsonError(w, 500, err)
			return
		}
		s.store.SetCurrency(cur)
	}

	if req.Shared.UnitSystem != "" {
		unit := strings.ToLower(strings.TrimSpace(req.Shared.UnitSystem))
		switch unit {
		case "metric":
			if err := s.store.PutUnitSystem(data.UnitsMetric); err != nil {
				jsonError(w, 500, err)
				return
			}
		case "imperial":
			if err := s.store.PutUnitSystem(data.UnitsImperial); err != nil {
				jsonError(w, 500, err)
				return
			}
		default:
			jsonError(w, 400, fmt.Errorf("invalid unit system %q", req.Shared.UnitSystem))
			return
		}
	}

	resp, err := s.settingsPayload()
	if err != nil {
		jsonError(w, 500, err)
		return
	}
	jsonOK(w, resp)
}

func (s *Server) settingsPayload() (settingsResponse, error) {
	cfg, err := s.loadConfig()
	if err != nil {
		return settingsResponse{}, fmt.Errorf("load config: %w", err)
	}
	shared, err := s.sharedSettingsPayload(cfg)
	if err != nil {
		return settingsResponse{}, err
	}
	return settingsResponse{
		Shared: shared,
		System: systemSettingsResponse{
			AddressAutofill:      cfg.Address.IsAutofillEnabled(),
			DocumentsMaxFileSize: marshalByteSize(cfg.Documents.MaxFileSize),
			DocumentsCacheTTL:    config.FormatDuration(cfg.Documents.CacheTTLDuration()),
			ChatProvider:         cfg.Chat.LLM.Provider,
			ChatBaseURL:          cfg.Chat.LLM.BaseURL,
			ChatModel:            cfg.Chat.LLM.Model,
			ChatTimeout:          cfg.Chat.LLM.Timeout,
			ExtractionMaxPages:   cfg.Extraction.MaxPages,
			ExtractionOCREnabled: cfg.Extraction.OCR.IsEnabled(),
			ExtractionLLMEnabled: cfg.Extraction.LLM.IsEnabled(),
		},
	}, nil
}

func (s *Server) sharedSettingsPayload(cfg config.Config) (sharedSettingsResponse, error) {
	code := s.store.Currency().Code()
	if code == "" {
		stored, err := s.store.GetCurrency()
		if err != nil {
			return sharedSettingsResponse{}, err
		}
		if stored != "" {
			code = stored
		} else if cfg.Locale.Currency != "" {
			code = strings.ToUpper(cfg.Locale.Currency)
		} else {
			code = locale.DefaultCurrency().Code()
		}
	}
	unitSystem, err := s.store.GetUnitSystem()
	if err != nil {
		return sharedSettingsResponse{}, err
	}
	return sharedSettingsResponse{
		Currency:   code,
		UnitSystem: unitSystem.String(),
	}, nil
}

func marshalByteSize(size config.ByteSize) string {
	text, err := size.MarshalText()
	if err != nil {
		return ""
	}
	return string(text)
}
