CREATE TABLE price_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  ingestion_id UUID NOT NULL REFERENCES price_ingestions(id) ON DELETE CASCADE,
  grade_id UUID REFERENCES product_grades(id),
  raw_grade_text TEXT NOT NULL,
  raw_price_text TEXT,
  price_usd DECIMAL(10,2),
  price_unit TEXT DEFAULT 'MT',
  incoterm TEXT DEFAULT 'CFR',
  port TEXT DEFAULT 'CALLAO',
  validity_start DATE,
  validity_end DATE,
  is_matched BOOLEAN NOT NULL DEFAULT false,
  match_confidence DECIMAL(3,2),
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_price_entries_ingestion ON price_entries(ingestion_id);
CREATE INDEX idx_price_entries_grade ON price_entries(grade_id);
CREATE INDEX idx_price_entries_tenant_date ON price_entries(tenant_id, created_at DESC);

ALTER TABLE price_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_price_entries ON price_entries
  USING (tenant_id = (current_setting('app.current_tenant_id', true))::UUID);

CREATE POLICY service_role_price_entries ON price_entries
  FOR ALL USING (auth.role() = 'service_role');
