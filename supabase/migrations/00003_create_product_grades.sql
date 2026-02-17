CREATE TABLE product_grades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  family_id UUID NOT NULL REFERENCES material_families(id),
  grade_code TEXT NOT NULL,
  grade_code_normalized TEXT NOT NULL,
  brand TEXT,
  manufacturer TEXT,
  uso TEXT,
  subtipo_uso TEXT,
  melt_index DECIMAL,
  melt_index_label TEXT,
  additives TEXT,
  attributes TEXT,
  process TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, grade_code_normalized)
);

CREATE INDEX idx_product_grades_tenant ON product_grades(tenant_id);
CREATE INDEX idx_product_grades_family ON product_grades(family_id);
CREATE INDEX idx_product_grades_code ON product_grades(grade_code_normalized);
CREATE INDEX idx_product_grades_uso ON product_grades(tenant_id, uso);

ALTER TABLE product_grades ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_product_grades ON product_grades
  USING (tenant_id = (current_setting('app.current_tenant_id', true))::UUID);

CREATE POLICY service_role_product_grades ON product_grades
  FOR ALL USING (auth.role() = 'service_role');
