-- Add numeric taste weight column to support tiered rating influence.
-- Nullable: in-app ratings derive weight from the rating type string;
-- Letterboxd imports store an explicit weight from the star tier mapping.
alter table user_movie_ratings
  add column if not exists taste_weight numeric;
