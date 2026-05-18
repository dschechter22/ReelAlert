-- user_movie_ratings: stores liked/disliked/seen/not_interested per user+movie
-- genre_ids and keywords are denormalized so taste profile can be recomputed
-- without re-hitting TMDB.

create table if not exists user_movie_ratings (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references auth.users(id) on delete cascade not null,
  tmdb_id      integer not null,
  title        text,
  poster_path  text,
  genre_ids    integer[] default '{}',
  keywords     text[]   default '{}',
  director_id  integer,
  rating       text not null check (rating in ('liked','disliked','seen','not_interested')),
  rated_at     timestamptz default now(),
  unique(user_id, tmdb_id)
);

alter table user_movie_ratings enable row level security;

create policy "Users manage own ratings"
  on user_movie_ratings for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists user_movie_ratings_user_id_idx on user_movie_ratings(user_id);
