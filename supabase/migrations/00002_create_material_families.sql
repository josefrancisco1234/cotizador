CREATE TABLE material_families (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  code TEXT NOT NULL,
  display_name TEXT NOT NULL,
  aliases TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, code)
);

CREATE INDEX idx_material_families_tenant ON material_families(tenant_id);

ALTER TABLE material_families ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_material_families ON material_families
  USING (tenant_id = (current_setting('app.current_tenant_id', true))::UUID);

CREATE POLICY service_role_material_families ON material_families
  FOR ALL USING (auth.role() = 'service_role');
