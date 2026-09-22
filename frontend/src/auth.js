import { createClient } from '@supabase/supabase-js'

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim()
const publishableKey = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '').trim()

export const authConfigured = Boolean(supabaseUrl && publishableKey)
export const supabase = authConfigured
  ? createClient(supabaseUrl, publishableKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null

function ensureConfigured() {
  if (!supabase) throw new Error('Supabase Auth is not configured. Add the VITE_SUPABASE_* values to frontend/.env.')
}

function normalizeSession(session) {
  if (!session?.access_token || !session?.user) return null
  return {
    email: session.user.email || 'User',
    token: session.access_token,
    userId: session.user.id,
  }
}

export async function signUp(email, password) {
  ensureConfigured()
  const { data, error } = await supabase.auth.signUp({ email, password })
  if (error) throw error
  return data
}

export async function signIn(email, password) {
  ensureConfigured()
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data
}


export async function requestPasswordReset(email) {
  ensureConfigured()
  const redirectTo = `${window.location.origin}/reset-password`
  const { data, error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo })
  if (error) throw error
  return data
}

export async function updatePassword(password) {
  ensureConfigured()
  const { data, error } = await supabase.auth.updateUser({ password })
  if (error) throw error
  return data
}

export async function signOut() {
  if (!supabase) return
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

export async function getSession() {
  if (!supabase) return null
  const { data, error } = await supabase.auth.getSession()
  if (error) return null
  return normalizeSession(data.session)
}

export function subscribeAuth(callback) {
  if (!supabase) return () => {}
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(normalizeSession(session))
  })
  return () => data.subscription.unsubscribe()
}
