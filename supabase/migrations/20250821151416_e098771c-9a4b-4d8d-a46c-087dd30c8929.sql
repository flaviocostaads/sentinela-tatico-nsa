-- Fix checkpoint data persistence by ensuring checklist_items are properly stored
-- Add trigger to prevent accidental deletion of checkpoint data
CREATE OR REPLACE FUNCTION public.preserve_checkpoint_data()
RETURNS TRIGGER AS $$
BEGIN
  -- Ensure checklist_items are preserved during updates
  IF NEW.checklist_items IS NULL AND OLD.checklist_items IS NOT NULL THEN
    NEW.checklist_items = OLD.checklist_items;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to preserve checkpoint data
DROP TRIGGER IF EXISTS preserve_checkpoint_data_trigger ON public.checkpoints;
CREATE TRIGGER preserve_checkpoint_data_trigger
  BEFORE UPDATE ON public.checkpoints
  FOR EACH ROW
  EXECUTE FUNCTION public.preserve_checkpoint_data();