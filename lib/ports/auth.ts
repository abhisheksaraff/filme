// lib/ports/auth.ts
/** Signing in and out; the rest of the app never talks to the sign-in service directly. */
export interface AuthProvider {
  signIn(email: string, password: string): Promise<{ error: string | null }>;
  signOut(): Promise<void>;
  hasSession(): Promise<boolean>;
}
