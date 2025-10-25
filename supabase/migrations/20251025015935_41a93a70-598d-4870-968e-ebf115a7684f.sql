-- Populate missing checkpoint coordinates with client coordinates
-- This migration fixes checkpoints that don't have lat/lng by using their parent client's coordinates

UPDATE checkpoints cp
SET 
  lat = c.lat,
  lng = c.lng
FROM clients c
WHERE cp.client_id = c.id
  AND (cp.lat IS NULL OR cp.lng IS NULL)
  AND c.lat IS NOT NULL 
  AND c.lng IS NOT NULL;

-- Add a comment to explain the update
COMMENT ON TABLE checkpoints IS 'Checkpoints represent specific locations for security rounds. Coordinates can be inherited from parent client if not explicitly set.';