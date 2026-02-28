-- Stores verified parsing examples (format bank) so the parser
-- can be tested against known supplier email formats.

CREATE TABLE parsing_examples (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  supplier_name TEXT NOT NULL DEFAULT '',
  raw_text TEXT NOT NULL,
  verified_rows JSONB NOT NULL DEFAULT '[]',
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_parsing_examples_tenant ON parsing_examples(tenant_id);

ALTER TABLE parsing_examples ENABLE ROW LEVEL SECURITY;

CREATE POLICY service_role_parsing_examples ON parsing_examples
  FOR ALL USING (auth.role() = 'service_role');
