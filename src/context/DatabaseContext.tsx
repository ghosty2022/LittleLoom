// src/context/DatabaseContext.tsx
// ─────────────────────────────────────────────────────────────────────
// DEPRECATED: DatabaseContext is a no-op pass-through.
//
// WHY THIS EXISTS:
// The old DatabaseContext polled Supabase on every cold start to try
// to refresh a session that didn't exist yet, spamming:
//   "[DB] Session expired, attempting refresh..."
//   "[DB] Session refresh failed"
// BEFORE the user even reached the login screen.
//
// That loop also competed with AuthContext's own session reads, which
// made `supabase.auth.getSession()` intermittently return null — and
// that in turn made BabyContext / FamilyContext see "no user ID".
//
// Session lifecycle is now owned EXCLUSIVELY by AuthContext. The
// Supabase client is a singleton. There is nothing left for this
// provider to do.
//
// We keep this file (and its hooks) so existing imports don't break,
// but it no longer touches Supabase at all. Every value it exposes is
// derived from AuthContext, which is the single source of truth.
// ─────────────────────────────────────────────────────────────────────

import React, { createContext, useContext, useMemo } from 'react';

// ─── Safe optional import of AuthContext ─────────────────────────────
// We import lazily to avoid circular-dependency issues during app
// bootstrap (AuthProvider may not be mounted yet when this module
// is first evaluated).
let useAuthSafe: (() => any) | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const authModule = require('./AuthContext');
  useAuthSafe = authModule.useAuth ?? null;
} catch {
  useAuthSafe = null;
}

// ─── TYPES ───────────────────────────────────────────────────────────

interface DatabaseContextType {
  isReady: boolean;
  error: Error | null;
  retry: () => void;
  isOnline: boolean;
  userId: string | null;
  session: any | null;
  refreshSession: () => Promise<void>;
  signOut: () => Promise<void>;
}

// ─── DEFAULT VALUE (never returned to consumers) ─────────────────────
// We still define it for TypeScript's benefit; the hook below always
// returns a real object.

const DEFAULT_VALUE: DatabaseContextType = {
  isReady: true,
  error: null,
  retry: () => {},
  isOnline: true,
  userId: null,
  session: null,
  refreshSession: async () => {},
  signOut: async () => {},
};

const DatabaseContext = createContext<DatabaseContextType>(DEFAULT_VALUE);

// ─── HOOK ────────────────────────────────────────────────────────────

/**
 * Safe hook — never throws, always returns a valid object.
 *
 * Consumers that used to rely on `useDatabase().userId` and
 * `useDatabase().session` will now get the values from AuthContext.
 */
export const useDatabase = (): DatabaseContextType => {
  const ctx = useContext(DatabaseContext);
  return ctx ?? DEFAULT_VALUE;
};

// Alias kept for backward compatibility with older imports.
export const useSafeDatabase = useDatabase;

// ─── PROVIDER ────────────────────────────────────────────────────────

/**
 * DatabaseProvider — pure pass-through.
 *
 * It reads state from AuthContext and forwards it. It NEVER touches
 * Supabase directly. This is what removes the "Session expired" flood
 * from the logs.
 *
 * If AuthProvider isn't mounted yet (early bootstrap), the provider
 * falls back to inert defaults without logging or retrying anything.
 */
export const DatabaseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Read AuthContext if the hook is available. This is safe because
  // AuthProvider is always mounted ABOVE DatabaseProvider in App.tsx.
  let auth: any = null;
  try {
    if (useAuthSafe) {
      auth = useAuthSafe();
    }
  } catch {
    // AuthProvider not mounted — fall through to inert defaults.
    auth = null;
  }

  // Derive the minimal surface this context exposes. All values come
  // straight from AuthContext — no polling, no retries, no logs.
  const value = useMemo<DatabaseContextType>(() => {
    const derivedUserId: string | null =
      auth?.userProfile?.id ??
      auth?.session?.user?.id ??
      null;

    return {
      isReady: auth ? !auth.isLoading : true,
      error: null,

      // No-op. AuthContext owns session recovery. There is nothing
      // here to retry.
      retry: () => {},

      // Always true. Real connectivity checks belong in a dedicated
      // network-status module, not in a database provider.
      isOnline: true,

      userId: derivedUserId,
      session: auth?.session ?? null,

      // Delegate to AuthContext — single source of truth. Swallow
      // errors so consumers don't crash if AuthContext is missing.
      refreshSession: async () => {
        try {
          if (typeof auth?.refreshSession === 'function') {
            await auth.refreshSession();
          }
        } catch {
          // Silent — AuthContext logs its own errors.
        }
      },

      signOut: async () => {
        try {
          if (typeof auth?.signOut === 'function') {
            await auth.signOut();
          }
        } catch {
          // Silent — AuthContext logs its own errors.
        }
      },
    };
  }, [
    auth?.isLoading,
    auth?.userProfile?.id,
    auth?.session,
    auth?.refreshSession,
    auth?.signOut,
  ]);

  return (
    <DatabaseContext.Provider value={value}>
      {children}
    </DatabaseContext.Provider>
  );
};

export default DatabaseProvider;