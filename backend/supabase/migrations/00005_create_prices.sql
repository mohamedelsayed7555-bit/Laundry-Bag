-- Prices table: item_type × service_type = price
CREATE TABLE prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_type VARCHAR NOT NULL,
  service_type VARCHAR NOT NULL CHECK (service_type IN ('wash', 'iron', 'wash_iron', 'dry_clean')),
  price DECIMAL(10, 2) NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(item_type, service_type)
);

CREATE TRIGGER prices_updated_at
  BEFORE UPDATE ON prices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
