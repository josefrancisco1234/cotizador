CREATE TABLE suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  name TEXT NOT NULL,
  email_patterns TEXT[] NOT NULL DEFAULT '{}',
  default_incoterm TEXT DEFAULT 'CFR',
  default_port TEXT DEFAULT 'CALLAO',
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, name)
);

CREATE INDEX idx_suppliers_tenant ON suppliers(tenant_id);

ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_suppliers ON suppliers
  USING (tenant_id = (current_setting('app.current_tenant_id', true))::UUID);

CREATE POLICY service_role_suppliers ON suppliers
  FOR ALL USING (auth.role() = 'service_role');
