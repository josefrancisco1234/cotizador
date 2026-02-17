CREATE TYPE contact_department AS ENUM ('purchasing', 'imports', 'billing');
CREATE TYPE contact_channel AS ENUM ('email', 'whatsapp');

CREATE TABLE client_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  department contact_department NOT NULL,
  salutation TEXT,
  contact_name TEXT,
  full_name TEXT,
  channel contact_channel NOT NULL,
  channel_value TEXT NOT NULL,
  priority INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, client_id, department, channel, channel_value)
);

CREATE INDEX idx_contacts_client ON client_contacts(client_id);
CREATE INDEX idx_contacts_dept ON client_contacts(tenant_id, department);

ALTER TABLE client_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_client_contacts ON client_contacts
  USING (tenant_id = (current_setting('app.current_tenant_id', true))::UUID);

CREATE POLICY service_role_client_contacts ON client_contacts
  FOR ALL USING (auth.role() = 'service_role');
