CREATE TYPE quotation_status AS ENUM ('draft', 'approved', 'sending', 'sent', 'partially_sent', 'failed');

CREATE TABLE quotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  ingestion_id UUID REFERENCES price_ingestions(id),
  title TEXT,
  status quotation_status NOT NULL DEFAULT 'draft',
  payment_terms TEXT,
  shipment_terms TEXT,
  notes TEXT,
  total_recipients INT DEFAULT 0,
  total_dispatched INT DEFAULT 0,
  created_by UUID,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_quotations_tenant ON quotations(tenant_id);
CREATE INDEX idx_quotations_status ON quotations(tenant_id, status);

ALTER TABLE quotations ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_quotations ON quotations
  USING (tenant_id = (current_setting('app.current_tenant_id', true))::UUID);

CREATE POLICY service_role_quotations ON quotations
  FOR ALL USING (auth.role() = 'service_role');
