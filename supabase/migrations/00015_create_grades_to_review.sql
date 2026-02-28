-- Grades seen in supplier emails that don't exist in product_grades yet.
-- Accumulates automatically so the admin can periodically review and
-- add them to BD0_DICCIONARIO / product_grades.

CREATE TABLE grades_to_review (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  grade_code TEXT NOT NULL,
  grade_code_normalized TEXT NOT NULL,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  times_seen INTEGER NOT NULL DEFAULT 1,
  source TEXT,          -- 'ingestion' | 'parse-preview'
  added_to_dict BOOLEAN NOT NULL DEFAULT false,
  UNIQUE(tenant_id, grade_code_normalized)
);

CREATE INDEX idx_grades_to_review_tenant ON grades_to_review(tenant_id);
CREATE INDEX idx_grades_to_review_added ON grades_to_review(tenant_id, added_to_dict);

ALTER TABLE grades_to_review ENABLE ROW LEVEL SECURITY;

CREATE POLICY service_role_grades_to_review ON grades_to_review
  FOR ALL USING (auth.role() = 'service_role');
