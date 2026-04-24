// Copyright 2026 Phillip Cloud
// Licensed under the Apache License, Version 2.0

package data

import (
	"errors"
	"fmt"
	"time"

	"gorm.io/gorm"
)

var ErrUnknownTrashEntity = errors.New("unknown trash entity")

type TrashItem struct {
	Entity      string    `json:"entity"`
	EntityLabel string    `json:"entity_label"`
	TargetID    string    `json:"target_id"`
	Label       string    `json:"label"`
	DeletedAt   time.Time `json:"deleted_at"`
}

func (s *Store) ListTrashItems() ([]TrashItem, error) {
	var records []DeletionRecord
	if err := s.db.
		Where(ColRestoredAt + " IS NULL").
		Order(ColDeletedAt + " desc, " + ColID + " desc").
		Find(&records).Error; err != nil {
		return nil, err
	}

	items := make([]TrashItem, 0, len(records))
	for _, record := range records {
		label, err := s.trashLabel(record.Entity, record.TargetID)
		if err != nil {
			return nil, err
		}
		items = append(items, TrashItem{
			Entity:      record.Entity,
			EntityLabel: trashEntityLabel(record.Entity),
			TargetID:    record.TargetID,
			Label:       label,
			DeletedAt:   record.DeletedAt,
		})
	}
	return items, nil
}

func (s *Store) RestoreTrashItem(entity, id string) error {
	switch entity {
	case DeletionEntityProject:
		return s.RestoreProject(id)
	case DeletionEntityQuote:
		return s.RestoreQuote(id)
	case DeletionEntityMaintenance:
		return s.RestoreMaintenance(id)
	case DeletionEntityAppliance:
		return s.RestoreAppliance(id)
	case DeletionEntityServiceLog:
		return s.RestoreServiceLog(id)
	case DeletionEntityVendor:
		return s.RestoreVendor(id)
	case DeletionEntityDocument:
		return s.RestoreDocument(id)
	case DeletionEntityIncident:
		return s.RestoreIncident(id)
	default:
		return fmt.Errorf("%w: %s", ErrUnknownTrashEntity, entity)
	}
}

func (s *Store) trashLabel(entity, id string) (string, error) {
	switch entity {
	case DeletionEntityProject:
		var item Project
		if err := s.db.Unscoped().First(&item, ColID+" = ?", id).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return fallbackTrashLabel(entity, id), nil
			}
			return "", err
		}
		if item.Title != "" {
			return item.Title, nil
		}
	case DeletionEntityQuote:
		var item Quote
		if err := s.db.Unscoped().First(&item, ColID+" = ?", id).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return fallbackTrashLabel(entity, id), nil
			}
			return "", err
		}
		if item.Notes != "" {
			return item.Notes, nil
		}
		if item.TotalCents != 0 {
			return fmt.Sprintf("Quote $%.2f", float64(item.TotalCents)/100), nil
		}
	case DeletionEntityMaintenance:
		var item MaintenanceItem
		if err := s.db.Unscoped().First(&item, ColID+" = ?", id).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return fallbackTrashLabel(entity, id), nil
			}
			return "", err
		}
		if item.Name != "" {
			return item.Name, nil
		}
	case DeletionEntityAppliance:
		var item Appliance
		if err := s.db.Unscoped().First(&item, ColID+" = ?", id).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return fallbackTrashLabel(entity, id), nil
			}
			return "", err
		}
		if item.Name != "" {
			return item.Name, nil
		}
	case DeletionEntityServiceLog:
		var item ServiceLogEntry
		if err := s.db.Unscoped().First(&item, ColID+" = ?", id).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return fallbackTrashLabel(entity, id), nil
			}
			return "", err
		}
		if item.Notes != "" {
			return item.Notes, nil
		}
		if !item.ServicedAt.IsZero() {
			return "Service on " + item.ServicedAt.Format("2006-01-02"), nil
		}
	case DeletionEntityVendor:
		var item Vendor
		if err := s.db.Unscoped().First(&item, ColID+" = ?", id).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return fallbackTrashLabel(entity, id), nil
			}
			return "", err
		}
		if item.Name != "" {
			return item.Name, nil
		}
	case DeletionEntityDocument:
		var item Document
		if err := s.db.Unscoped().First(&item, ColID+" = ?", id).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return fallbackTrashLabel(entity, id), nil
			}
			return "", err
		}
		if item.Title != "" {
			return item.Title, nil
		}
		if item.FileName != "" {
			return item.FileName, nil
		}
	case DeletionEntityIncident:
		var item Incident
		if err := s.db.Unscoped().First(&item, ColID+" = ?", id).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return fallbackTrashLabel(entity, id), nil
			}
			return "", err
		}
		if item.Title != "" {
			return item.Title, nil
		}
	}
	return fallbackTrashLabel(entity, id), nil
}

func trashEntityLabel(entity string) string {
	switch entity {
	case DeletionEntityProject:
		return "Project"
	case DeletionEntityQuote:
		return "Quote"
	case DeletionEntityMaintenance:
		return "Maintenance"
	case DeletionEntityAppliance:
		return "Appliance"
	case DeletionEntityServiceLog:
		return "Service log"
	case DeletionEntityVendor:
		return "Vendor"
	case DeletionEntityDocument:
		return "Document"
	case DeletionEntityIncident:
		return "Incident"
	default:
		return entity
	}
}

func fallbackTrashLabel(entity, id string) string {
	return trashEntityLabel(entity) + " " + id
}
