CREATE TABLE client_material_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  family_id UUID NOT NULL REFERENCES material_families(id),
  uso TEXT,
  melt_index DECIMAL,
  additives TEXT,
  process TEXT,
  observations TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, client_id, family_id, COALESCE(uso, ''), COALESCE(additives, ''))
);

CREATE INDEX idx_cmp_family ON client_material_preferences(family_id);
CREATE INDEX idx_cmp_client ON client_material_preferences(client_id);
CREATE INDEX idx_cmp_lookup ON client_material_preferences(tenant_id, family_id, uso);

ALTER TABLE client_material_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_cmp ON client_material_preferences
  USING (tenant_id = (current_setting('app.current_tenant_id', true))::UUID);

CREATE POLICY service_role_cmp ON client_material_preferences
  FOR ALL USING (auth.role() = 'service_role');
