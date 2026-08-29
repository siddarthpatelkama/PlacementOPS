/**
 * PlacementOps — Supabase Browser Client
 *
 * Uses @supabase/ssr to create a browser-safe Supabase client that
 * manages auth cookies securely within Next.js App Router client
 * components. Call `createClient()` inside any 'use client' component
 * to interact with Supabase auth, database, and storage.
 *
 * @module utils/supabase/client
 */

import { createBrowserClient } from "@supabase/ssr";

/**
 * Creates and returns a Supabase browser client configured with
 * the project's public URL and anonymous key from environment variables.
 *
 * @returns {ReturnType<typeof createBrowserClient>} Supabase client instance.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
