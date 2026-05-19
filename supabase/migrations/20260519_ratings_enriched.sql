-- Enrich rating rows with production metadata for stats analytics.
-- New ratings will populate these automatically; existing rows are
-- backfilled by the Stats page on first visit.
alter table user_movie_ratings
  add column if not exists release_year   integer,
  add column if not exists director_name  text,
  add column if not exists top_cast       text[],
  add column if not exists origin_country text,
  add column if not exists studio         text,
  add column if not exists collection     text;
