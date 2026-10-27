CREATE FUNCTION fill_initial_management_sale_price() RETURNS trigger AS $$
BEGIN
  IF NEW.management_sale_price IS NULL THEN
    NEW.management_sale_price := NEW.sale_price;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_initial_management_sale_price
BEFORE INSERT ON presentations
FOR EACH ROW EXECUTE FUNCTION fill_initial_management_sale_price();
