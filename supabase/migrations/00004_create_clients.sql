CREATE TYPE client_status AS ENUM ('active', 'prospect', 'inactive');
CREATE TYPE client_type AS ENUM ('transformer', 'distributor', 'transformer_distributor', 'rotomolding');

CREATE TABLE clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  client_code TEXT NOT NULL,
  business_name TEXT NOT NULL,
  ruc TEXT,
  zone TEXT,
  status client_status NOT NULL DEFAULT 'active',
  client_type client_type,
  addresses TEXT[] NOT NULL DEFAULT '{}',
  manufacturing_sectors TEXT[] NOT NULL DEFAULT '{}',
  processes TEXT[] NOT NULL DEFAULT '{}',
  final_products TEXT[] NOT NULL DEFAULT '{}',
  observations TEXT,
  grades_infogestion TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, client_code)
);

CREATE INDEX idx_clients_tenant ON clients(tenant_id);
CREATE INDEX idx_clients_status ON clients(tenant_id, status);
CREATE INDEX idx_clients_zone ON clients(tenant_id, zone);

ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_clients ON clients
  USING (tenant_id = (current_setting('app.current_tenant_id', true))::UUID);

CREATE POLICY service_role_clients ON clients
  FOR ALL USING (auth.role() = 'service_role');
