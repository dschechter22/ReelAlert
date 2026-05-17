/**
 * Mock movie data for development / demo use while real API keys are pending.
 * All ratings and metadata are realistic but fictional.
 */

export const MOCK_MOVIES = [
  {
    id: 'mock-1',
    tmdb_id: 1001,
    title: 'Veil of the Departed',
    synopsis:
      'A grief-stricken forensic photographer discovers that the ghosts she captures in crime-scene photos are trying to lead her to a serial killer still at large — one who may already know her name.',
    tmdb_score: 7.8,
    rt_critic: 91,
    rt_audience: 84,
    letterboxd_score: 3.9,
    trailer_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    genres: [
      { id: 27, name: 'Horror' },
      { id: 9648, name: 'Mystery' },
      { id: 53, name: 'Thriller' },
    ],
    release_date: '2025-05-02',
    in_theaters_until: '2025-06-15',
    poster_path: null,
    backdrop_path: null,
    cast: [
      { id: 9001, name: 'Saoirse Ronan' },
      { id: 9002, name: 'Oscar Isaac' },
    ],
    director: { id: 9050, name: 'Ari Aster' },
    posterGradient: 'from-slate-900 via-purple-950 to-slate-800',
    posterAccent: '#7C3AED',
  },
  {
    id: 'mock-2',
    tmdb_id: 1002,
    title: 'The Cartographer\'s Daughter',
    synopsis:
      'Set in 1920s Lisbon, a young cartographer uncovers her late father\'s secret maps — each one a portal to an alternate version of a city that never was.',
    tmdb_score: 8.1,
    rt_critic: 96,
    rt_audience: 89,
    letterboxd_score: 4.2,
    trailer_url: null,
    genres: [
      { id: 18, name: 'Drama' },
      { id: 14, name: 'Fantasy' },
      { id: 12, name: 'Adventure' },
    ],
    release_date: '2025-04-25',
    in_theaters_until: '2025-06-20',
    poster_path: null,
    backdrop_path: null,
    cast: [
      { id: 9003, name: 'Ana de Armas' },
      { id: 9004, name: 'Pedro Pascal' },
    ],
    director: { id: 9051, name: 'Céline Sciamma' },
    posterGradient: 'from-amber-900 via-orange-800 to-yellow-900',
    posterAccent: '#D97706',
  },
  {
    id: 'mock-3',
    tmdb_id: 1003,
    title: 'Overdrive',
    synopsis:
      'A retired Formula 1 driver is pulled back into the underground racing circuit when his estranged daughter is kidnapped by the syndicate that fixed his final race.',
    tmdb_score: 6.5,
    rt_critic: 62,
    rt_audience: 78,
    letterboxd_score: 3.1,
    trailer_url: null,
    genres: [
      { id: 28, name: 'Action' },
      { id: 53, name: 'Thriller' },
    ],
    release_date: '2025-05-09',
    in_theaters_until: '2025-06-22',
    poster_path: null,
    backdrop_path: null,
    cast: [
      { id: 9005, name: 'Idris Elba' },
      { id: 9006, name: 'Zendaya' },
    ],
    director: { id: 9052, name: 'David Leitch' },
    posterGradient: 'from-red-950 via-gray-900 to-zinc-800',
    posterAccent: '#DC2626',
  },
  {
    id: 'mock-4',
    tmdb_id: 1004,
    title: 'Lullaby for the End of the World',
    synopsis:
      'As an asteroid approaches Earth, an insomniac NASA scientist and a traveling musician spend the last 72 hours driving across the country to reach people they\'ve left behind.',
    tmdb_score: 8.4,
    rt_critic: 98,
    rt_audience: 93,
    letterboxd_score: 4.5,
    trailer_url: null,
    genres: [
      { id: 18, name: 'Drama' },
      { id: 10749, name: 'Romance' },
    ],
    release_date: '2025-04-18',
    in_theaters_until: '2025-06-10',
    poster_path: null,
    backdrop_path: null,
    cast: [
      { id: 9007, name: 'Cate Blanchett' },
      { id: 9008, name: 'Mahershala Ali' },
    ],
    director: { id: 9053, name: 'Kogonada' },
    posterGradient: 'from-indigo-950 via-blue-900 to-slate-800',
    posterAccent: '#3B82F6',
  },
  {
    id: 'mock-5',
    tmdb_id: 1005,
    title: 'Brood',
    synopsis:
      'When a suburban family\'s basement produces a strange mold that alters behavior, their teenage son becomes convinced the neighborhood itself is alive — and hungry.',
    tmdb_score: 6.9,
    rt_critic: 74,
    rt_audience: 65,
    letterboxd_score: 3.4,
    trailer_url: null,
    genres: [
      { id: 27, name: 'Horror' },
      { id: 878, name: 'Science Fiction' },
    ],
    release_date: '2025-05-01',
    in_theaters_until: '2025-06-05',
    poster_path: null,
    backdrop_path: null,
    cast: [
      { id: 9009, name: 'Toni Collette' },
      { id: 9010, name: 'Barry Keoghan' },
    ],
    director: { id: 9054, name: 'Julia Ducournau' },
    posterGradient: 'from-green-950 via-emerald-900 to-gray-900',
    posterAccent: '#059669',
  },
  {
    id: 'mock-6',
    tmdb_id: 1006,
    title: 'Still Waters',
    synopsis:
      'A hard-drinking detective in coastal Maine unravels a cold case involving a drowned fisherman, a missing heiress, and a lobster-fishing dynasty with centuries of secrets.',
    tmdb_score: 7.3,
    rt_critic: 83,
    rt_audience: 77,
    letterboxd_score: 3.7,
    trailer_url: null,
    genres: [
      { id: 80, name: 'Crime' },
      { id: 9648, name: 'Mystery' },
      { id: 18, name: 'Drama' },
    ],
    release_date: '2025-04-30',
    in_theaters_until: '2025-06-12',
    poster_path: null,
    backdrop_path: null,
    cast: [
      { id: 9011, name: 'Viola Davis' },
      { id: 9012, name: 'Josh O\'Connor' },
    ],
    director: { id: 9055, name: 'Kelly Reichardt' },
    posterGradient: 'from-cyan-950 via-slate-800 to-gray-900',
    posterAccent: '#0891B2',
  },
  {
    id: 'mock-7',
    tmdb_id: 1007,
    title: 'Punchline',
    synopsis:
      'A stand-up comedian\'s debut Netflix special goes viral for the wrong reason — it exposes a government surveillance program — and suddenly everyone wants him silenced.',
    tmdb_score: 7.0,
    rt_critic: 79,
    rt_audience: 88,
    letterboxd_score: 3.6,
    trailer_url: null,
    genres: [
      { id: 35, name: 'Comedy' },
      { id: 53, name: 'Thriller' },
    ],
    release_date: '2025-05-07',
    in_theaters_until: '2025-06-18',
    poster_path: null,
    backdrop_path: null,
    cast: [
      { id: 9013, name: 'Donald Glover' },
      { id: 9014, name: 'Awkwafina' },
    ],
    director: { id: 9056, name: 'Jordan Peele' },
    posterGradient: 'from-yellow-900 via-orange-900 to-red-950',
    posterAccent: '#F59E0B',
  },
]

/**
 * Default user preferences used for mock ReelScore computation.
 */
export const DEFAULT_MOCK_PREFS = {
  genrePreferences: [
    { genre_id: 18, priority: 'must_see' },   // Drama
    { genre_id: 9648, priority: 'must_see' }, // Mystery
    { genre_id: 35, priority: 'fine' },       // Comedy
    { genre_id: 28, priority: 'fine' },       // Action
  ],
  peoplePreferences: [
    { tmdb_person_id: 9050, preference_type: 'favorite', person_name: 'Ari Aster' },
    { tmdb_person_id: 9053, preference_type: 'favorite', person_name: 'Kogonada' },
  ],
}
