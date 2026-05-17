-- ============================================================
-- ReelAlert Initial Database Schema
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- users (extends Supabase auth.users)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.users (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email         TEXT NOT NULL,
  phone_number  TEXT,
  zip_code      TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sms_cadence   TEXT NOT NULL DEFAULT 'weekly' CHECK (sms_cadence IN ('daily', 'weekly', 'biweekly')),
  sms_day       TEXT,
  sms_time      TIME DEFAULT '10:00:00'
);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read and update their own record"
  ON public.users FOR ALL
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Auto-create a users row on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- user_rating_thresholds
-- ============================================================
CREATE TABLE IF NOT EXISTS public.user_rating_thresholds (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id          UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  source           TEXT NOT NULL CHECK (source IN ('tmdb', 'rt_critic', 'rt_audience', 'letterboxd')),
  min_score        NUMERIC NOT NULL,
  and_or_operator  TEXT NOT NULL DEFAULT 'and' CHECK (and_or_operator IN ('and', 'or')),
  UNIQUE (user_id, source)
);

ALTER TABLE public.user_rating_thresholds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own rating thresholds"
  ON public.user_rating_thresholds FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- user_genre_thresholds
-- ============================================================
CREATE TABLE IF NOT EXISTS public.user_genre_thresholds (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id          UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  genre_id         INTEGER NOT NULL,
  source           TEXT NOT NULL CHECK (source IN ('tmdb', 'rt_critic', 'rt_audience', 'letterboxd')),
  min_score        NUMERIC NOT NULL,
  and_or_operator  TEXT NOT NULL DEFAULT 'and' CHECK (and_or_operator IN ('and', 'or')),
  UNIQUE (user_id, genre_id, source)
);

ALTER TABLE public.user_genre_thresholds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own genre thresholds"
  ON public.user_genre_thresholds FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- user_genre_preferences
-- ============================================================
CREATE TABLE IF NOT EXISTS public.user_genre_preferences (
  id        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id   UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  genre_id  INTEGER NOT NULL,
  priority  TEXT NOT NULL CHECK (priority IN ('must_see', 'fine', 'never')),
  UNIQUE (user_id, genre_id)
);

ALTER TABLE public.user_genre_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own genre preferences"
  ON public.user_genre_preferences FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- user_people_preferences
-- ============================================================
CREATE TABLE IF NOT EXISTS public.user_people_preferences (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id          UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  tmdb_person_id   INTEGER NOT NULL,
  person_name      TEXT NOT NULL,
  preference_type  TEXT NOT NULL CHECK (preference_type IN ('favorite', 'excluded')),
  UNIQUE (user_id, tmdb_person_id)
);

ALTER TABLE public.user_people_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own people preferences"
  ON public.user_people_preferences FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- user_theater_preferences
-- ============================================================
CREATE TABLE IF NOT EXISTS public.user_theater_preferences (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  amc_theater_id  TEXT NOT NULL,
  UNIQUE (user_id, amc_theater_id)
);

ALTER TABLE public.user_theater_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own theater preferences"
  ON public.user_theater_preferences FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- movies
-- ============================================================
CREATE TABLE IF NOT EXISTS public.movies (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tmdb_id              INTEGER UNIQUE NOT NULL,
  title                TEXT NOT NULL,
  synopsis             TEXT,
  tmdb_score           NUMERIC,
  rt_critic            NUMERIC,
  rt_audience          NUMERIC,
  letterboxd_score     NUMERIC,
  trailer_url          TEXT,
  genres               JSONB DEFAULT '[]',
  release_date         DATE,
  cast                 JSONB DEFAULT '[]',
  director             JSONB,
  in_theaters_until    DATE,
  ratings_last_updated TIMESTAMPTZ,
  poster_path          TEXT,
  backdrop_path        TEXT
);

ALTER TABLE public.movies ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read movies
CREATE POLICY "Authenticated users can read movies"
  ON public.movies FOR SELECT
  USING (auth.role() = 'authenticated');

-- Only service role can write movies (populated by edge functions)
CREATE POLICY "Service role can manage movies"
  ON public.movies FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================================
-- user_movie_scores
-- ============================================================
CREATE TABLE IF NOT EXISTS public.user_movie_scores (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id             UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  movie_id            UUID NOT NULL REFERENCES public.movies(id) ON DELETE CASCADE,
  reel_score          NUMERIC NOT NULL,
  bucket              TEXT NOT NULL CHECK (bucket IN ('must-see', 'worth-watching', 'if-youre-interested', 'not-for-you')),
  genre_match         BOOLEAN DEFAULT FALSE,
  threshold_results   JSONB DEFAULT '{}',
  favorites_triggered BOOLEAN DEFAULT FALSE,
  computed_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, movie_id)
);

ALTER TABLE public.user_movie_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own movie scores"
  ON public.user_movie_scores FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role manages all movie scores"
  ON public.user_movie_scores FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================================
-- user_watchlist
-- ============================================================
CREATE TABLE IF NOT EXISTS public.user_watchlist (
  id        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id   UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  movie_id  TEXT NOT NULL,
  added_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, movie_id)
);

ALTER TABLE public.user_watchlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own watchlist"
  ON public.user_watchlist FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- sms_log
-- ============================================================
CREATE TABLE IF NOT EXISTS public.sms_log (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id          UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  sent_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  movies_included  JSONB DEFAULT '[]',
  status           TEXT DEFAULT 'sent',
  twilio_sid       TEXT
);

ALTER TABLE public.sms_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own SMS log"
  ON public.sms_log FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role manages SMS log"
  ON public.sms_log FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================================
-- Indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_user_movie_scores_user ON public.user_movie_scores(user_id);
CREATE INDEX IF NOT EXISTS idx_user_movie_scores_bucket ON public.user_movie_scores(bucket);
CREATE INDEX IF NOT EXISTS idx_user_watchlist_user ON public.user_watchlist(user_id);
CREATE INDEX IF NOT EXISTS idx_sms_log_user ON public.sms_log(user_id);
CREATE INDEX IF NOT EXISTS idx_movies_tmdb_id ON public.movies(tmdb_id);
