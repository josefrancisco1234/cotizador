CREATE TABLE quotation_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_id UUID NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
  price_entry_id UUID NOT NULL REFERENCES price_entries(id),
  grade_id UUID NOT NULL REFERENCES product_grades(id),
  price_usd DECIMAL(10,2) NOT NULL,
  custom_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_quotation_items_quotation ON quotation_items(quotation_id);

ALTER TABLE quotation_items ENABLE ROW LEVEL SECURITY;

-- quotation_items inherits tenant scope through quotation join
CREATE POLICY service_role_quotation_items ON quotation_items
  FOR ALL USING (auth.role() = 'service_role');
