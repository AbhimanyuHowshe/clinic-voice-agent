import { createBrowserClient } from "@supabase/ssr";

// Browser Supabase client acting as the signed-in staff member (publishable key + session
// cookie). Used only for live updates; every row it can see is still limited by RLS.
export function createClient() {
  return createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}
