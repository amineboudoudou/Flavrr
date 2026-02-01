-- Enable Realtime for owner portal subscriptions
-- Owner portal will subscribe to orders and deliveries tables

-- Add realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE orders;
ALTER PUBLICATION supabase_realtime ADD TABLE deliveries;
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;

-- Create function to broadcast order events  
CREATE OR REPLACE FUNCTION notify_order_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Notify via pg_notify for additional custom handling if needed
  PERFORM pg_notify(
    'order_change',
    json_build_object(
      'operation', TG_OP,
      'order_id', COALESCE(NEW.id, OLD.id),
      'org_id', COALESCE(NEW.org_id, OLD.org_id),
      'status', COALESCE(NEW.status, OLD.status)
    )::text
  );
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER order_change_trigger
AFTER INSERT OR UPDATE OR DELETE ON orders
FOR EACH ROW
EXECUTE FUNCTION notify_order_change();
