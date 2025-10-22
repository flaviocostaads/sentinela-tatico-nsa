-- Add 'on_foot' to vehicle_type enum
ALTER TYPE vehicle_type ADD VALUE IF NOT EXISTS 'on_foot';