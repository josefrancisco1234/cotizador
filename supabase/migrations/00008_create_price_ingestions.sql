CREATE TYPE ingestion_status AS ENUM ('pending', 'processing', 'completed', 'failed', 'partial');

CREATE TABLE price_ingestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  supplier_id UUID REFERENCES suppliers(id),
  source_type TEXT NOT NULL DEFAULT 'email',
  source_identifier TEXT,
  source_subject TEXT,
  source_from TEXT,
  source_date TIMESTAMPTZ,
  raw_html TEXT,
  parsed_data JSONB,
  status ingestion_status NOT NULL DEFAULT 'pending',
  error_message TEXT,
  grades_found INT DEFAULT 0,
  grades_matched INT DEFAULT 0,
  grades_unknown INT DEFAULT 0,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, source_identifier)
);

CREATE INDEX idx_ingestions_tenant ON price_ingestions(tenant_id);
CREATE INDEX idx_ingestions_status ON price_ingestions(tenant_id, status);

ALTER TABLE price_ingestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_ingestions ON price_ingestions
  USING (tenant_id = (current_setting('app.current_tenant_id', true))::UUID);

CREATE POLICY service_role_ingestions ON price_ingestions
  FOR ALL USING (auth.role() = 'service_role');
