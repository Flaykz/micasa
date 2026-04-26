export type HouseProfile = {
  id: string
  nickname: string
  address_line1: string
  address_line2: string
  city: string
  state: string
  postal_code: string
  year_built: number
  square_feet: number
  lot_square_feet: number
  bedrooms: number
  bathrooms: number
  created_at: string
  updated_at: string
}

export type ProjectType = {
  id: string
  name: string
  created_at: string
  updated_at: string
}

export type MaintenanceCategory = {
  id: string
  name: string
  created_at: string
  updated_at: string
}

export type Project = {
  id: string
  title: string
  project_type_id: string
  status: string
  description: string
  start_date?: string | null
  end_date?: string | null
  budget_cents?: number | null
  actual_cents?: number | null
  created_at: string
  updated_at: string
}

export type Quote = {
  id: string
  project_id: string
  vendor_id: string
  total_cents: number
  labor_cents?: number | null
  materials_cents?: number | null
  received_date?: string | null
  notes: string
  created_at: string
  updated_at: string
}

export type Vendor = {
  id: string
  name: string
  contact_name: string
  email: string
  phone: string
  website: string
  notes: string
  locale: string
  created_at: string
  updated_at: string
}

export type MaintenanceItem = {
  id: string
  name: string
  category_id: string
  appliance_id?: string | null
  season: string
  last_serviced_at?: string | null
  interval_months: number
  due_date?: string | null
  notes: string
  cost_cents?: number | null
  created_at: string
  updated_at: string
}

export type Appliance = {
  id: string
  name: string
  brand: string
  model_number: string
  serial_number: string
  purchase_date?: string | null
  warranty_expiry?: string | null
  location: string
  cost_cents?: number | null
  notes: string
  created_at: string
  updated_at: string
}

export type Incident = {
  id: string
  title: string
  description: string
  status: string
  severity: string
  date_noticed: string
  date_resolved?: string | null
  location: string
  cost_cents?: number | null
  appliance_id?: string | null
  vendor_id?: string | null
  notes: string
  created_at: string
  updated_at: string
}

export type ServiceLogEntry = {
  id: string
  maintenance_item_id: string
  serviced_at: string
  vendor_id?: string | null
  cost_cents?: number | null
  notes: string
  created_at: string
  updated_at: string
}

export type Document = {
  id: string
  title: string
  file_name: string
  entity_kind: string
  entity_id: string
  mime_type: string
  size_bytes: number
  sha256: string
  extracted_text: string
  extraction_model: string
  notes: string
  created_at: string
  updated_at: string
}

export type DashboardResponse = {
  incidents: Incident[]
  maintenance: MaintenanceItem[]
  active_projects: Project[]
  expiring_warranties: Appliance[]
  house?: HouseProfile
  recent_service_logs: ServiceLogEntry[]
  ytd_service_spend_cents: number
  total_project_spend_cents: number
  currency_code: string
}

export type TrashItem = {
  entity: string
  entity_label: string
  target_id: string
  label: string
  deleted_at: string
}

export type SharedSettings = {
  currency: string
  unit_system: string
}

export type SystemSettings = {
  address_autofill: boolean
  documents_max_file_size: string
  documents_cache_ttl: string
  chat_provider: string
  chat_base_url: string
  chat_model: string
  chat_timeout: string
  extraction_max_pages: number
  extraction_ocr_enabled: boolean
  extraction_llm_enabled: boolean
}

export type SettingsResponse = {
  shared: SharedSettings
  system: SystemSettings
}
