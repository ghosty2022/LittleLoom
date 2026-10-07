























import React, { createContext, useContext, useMemo } from 'react';





let useAuthSafe: (() => any) | null = null;
try {
  
  const authModule = require('./AuthContext');
  useAuthSafe = authModule.useAuth ?? null;
} catch {
  useAuthSafe = null;
}



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


export const useSafeDatabase = useDatabase;



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
  
  
  let auth: any = null;
  try {
    if (useAuthSafe) {
      auth = useAuthSafe();
    }
  } catch {
    
    auth = null;
  }

  
  
  const value = useMemo<DatabaseContextType>(() => {
    const derivedUserId: string | null =
      auth?.userProfile?.id ??
      auth?.session?.user?.id ??
      null;

    return {
      isReady: auth ? !auth.isLoading : true,
      error: null,

      
      
      retry: () => {},

      
      
      isOnline: true,

      userId: derivedUserId,
      session: auth?.session ?? null,

      
      
      refreshSession: async () => {
        try {
          if (typeof auth?.refreshSession === 'function') {
            await auth.refreshSession();
          }
        } catch {
          
        }
      },

      signOut: async () => {
        try {
          if (typeof auth?.signOut === 'function') {
            await auth.signOut();
          }
        } catch {
          
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