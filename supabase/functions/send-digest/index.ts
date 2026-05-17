/**
 * ReelAlert SMS Digest Edge Function
 *
 * Triggered by Supabase cron (set up in the dashboard):
 *   Schedule: 0 10 * * 1   (every Monday at 10 AM UTC for weekly)
 *
 * Required Supabase secrets:
 *   TWILIO_ACCOUNT_SID
 *   TWILIO_AUTH_TOKEN
 *   TWILIO_FROM_NUMBER
 *
 * Environment vars (set automatically):
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const TWILIO_ACCOUNT_SID = Deno.env.get('TWILIO_ACCOUNT_SID')!
const TWILIO_AUTH_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN')!
const TWILIO_FROM = Deno.env.get('TWILIO_FROM_NUMBER')!

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

interface UserRow {
  id: string
  phone_number: string | null
  sms_cadence: string
}

interface MovieScore {
  reel_score: number
  bucket: string
  movies: {
    title: string
    genres: Array<{ id: number; name: string }>
  }
}

// ─────────────────────────────────────────────────────────────
// Twilio SMS
// ─────────────────────────────────────────────────────────────

async function sendSMS(to: string, body: string): Promise<string | null> {
  const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`
  const creds = btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`)

  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${creds}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ To: to, From: TWILIO_FROM, Body: body }),
  })

  if (!resp.ok) {
    const err = await resp.text()
    console.error(`Twilio error for ${to}:`, err)
    return null
  }

  const data = await resp.json()
  return data.sid
}

// ─────────────────────────────────────────────────────────────
// Digest message builder
// ─────────────────────────────────────────────────────────────

function buildDigestMessage(scores: MovieScore[], cadence: string): string {
  const cadenceLabel = cadence === 'daily' ? 'Daily' : cadence === 'biweekly' ? 'Bi-weekly' : 'Weekly'

  const bucketOrder = ['must-see', 'worth-watching', 'if-youre-interested']
  const top = scores
    .filter((s) => bucketOrder.includes(s.bucket))
    .sort((a, b) => {
      const ai = bucketOrder.indexOf(a.bucket)
      const bi = bucketOrder.indexOf(b.bucket)
      if (ai !== bi) return ai - bi
      return b.reel_score - a.reel_score
    })
    .slice(0, 5)

  if (top.length === 0) {
    return `🎬 ReelAlert ${cadenceLabel} Digest\n\nNo films matched your taste this week. Check your preferences at reelalert.app\n\nReply STOP to unsubscribe.`
  }

  const bucketEmoji: Record<string, string> = {
    'must-see': '⭐',
    'worth-watching': '✅',
    'if-youre-interested': '👀',
  }

  const lines = [
    `🎬 ReelAlert ${cadenceLabel} Digest`,
    `Your top picks in theaters:`,
    '',
    ...top.map((s, i) => {
      const genres = (s.movies.genres || []).slice(0, 2).map((g: any) => g.name || g).join(', ')
      const emoji = bucketEmoji[s.bucket] || '•'
      return `${i + 1}. ${emoji} ${s.movies.title}\n   Score: ${s.reel_score}/100 · ${genres}`
    }),
    '',
    `See full rankings: reelalert.app`,
    `Reply STOP to unsubscribe.`,
  ]

  return lines.join('\n')
}

// ─────────────────────────────────────────────────────────────
// Per-user digest sender
// ─────────────────────────────────────────────────────────────

async function sendDigestForUser(user: UserRow): Promise<void> {
  if (!user.phone_number) {
    console.log(`User ${user.id} has no phone number, skipping.`)
    return
  }

  // Fetch top movie scores for this user
  const { data: scores, error } = await supabase
    .from('user_movie_scores')
    .select('reel_score, bucket, movies(title, genres)')
    .eq('user_id', user.id)
    .order('reel_score', { ascending: false })
    .limit(10)

  if (error) {
    console.error(`Failed to fetch scores for user ${user.id}:`, error)
    return
  }

  const message = buildDigestMessage(scores as MovieScore[], user.sms_cadence)

  const sid = await sendSMS(user.phone_number, message)

  // Log the send
  await supabase.from('sms_log').insert({
    user_id: user.id,
    movies_included: (scores || []).slice(0, 5).map((s: any) => s.movies?.title),
    status: sid ? 'sent' : 'failed',
    twilio_sid: sid,
  })

  console.log(`Digest sent to user ${user.id} (${user.phone_number}), SID: ${sid}`)
}

// ─────────────────────────────────────────────────────────────
// Main handler
// ─────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  // Allow both GET (cron) and POST (manual trigger)
  if (req.method !== 'GET' && req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  // Optionally gate on a secret header for security
  const authHeader = req.headers.get('authorization')
  const expectedBearer = `Bearer ${SUPABASE_SERVICE_KEY}`
  if (authHeader && authHeader !== expectedBearer) {
    return new Response('Unauthorized', { status: 401 })
  }

  console.log('Starting digest send run…')

  try {
    // Determine which cadence to run based on current day/time
    // (For simplicity, send to all users — a real implementation would
    //  filter by sms_cadence and sms_day)
    const { data: users, error } = await supabase
      .from('users')
      .select('id, phone_number, sms_cadence')
      .not('phone_number', 'is', null)

    if (error) throw error

    if (!users || users.length === 0) {
      console.log('No users with phone numbers found.')
      return new Response(JSON.stringify({ sent: 0 }), {
        headers: { 'Content-Type': 'application/json' },
      })
    }

    console.log(`Sending digests to ${users.length} users…`)

    // Process in parallel (capped at 10 concurrent)
    const chunkSize = 10
    let sent = 0
    for (let i = 0; i < users.length; i += chunkSize) {
      const chunk = users.slice(i, i + chunkSize)
      await Promise.all(chunk.map((u) => sendDigestForUser(u as UserRow)))
      sent += chunk.length
    }

    console.log(`Digest run complete. Processed ${sent} users.`)

    return new Response(JSON.stringify({ sent, users: users.length }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('Digest run failed:', err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
