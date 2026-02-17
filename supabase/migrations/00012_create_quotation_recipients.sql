CREATE TYPE dispatch_status AS ENUM ('pending', 'queued', 'sent', 'delivered', 'read', 'failed', 'skipped');

CREATE TABLE quotation_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  quotation_id UUID NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id),
  contact_id UUID NOT NULL REFERENCES client_contacts(id),
  channel contact_channel NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  dispatch_status dispatch_status NOT NULL DEFAULT 'pending',
  dispatched_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  external_message_id TEXT,
  error_message TEXT,
  retry_count INT NOT NULL DEFAULT 0,
  next_retry_at TIMESTAMPTZ,
  message_snapshot JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_recipients_quotation ON quotation_recipients(quotation_id);
CREATE INDEX idx_recipients_status ON quotation_recipients(tenant_id, dispatch_status);
CREATE INDEX idx_recipients_retry ON quotation_recipients(dispatch_status, next_retry_at)
  WHERE dispatch_status = 'failed' AND next_retry_at IS NOT NULL;

ALTER TABLE quotation_recipients ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_recipients ON quotation_recipients
  USING (tenant_id = (current_setting('app.current_tenant_id', true))::UUID);

CREATE POLICY service_role_recipients ON quotation_recipients
  FOR ALL USING (auth.role() = 'service_role');
