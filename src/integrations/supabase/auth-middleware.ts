import { createMiddleware } from '@tanstack/react-start'
import { getSupabaseAdmin } from '@/lib/upsc.server'

export const requireSupabaseAuth = createMiddleware({ type: 'function' }).server(
  async ({ next }) => {
    const supabase = await getSupabaseAdmin();
    return next({
      context: {
        supabase,
        userId: 'local-dev-user',
        claims: {},
      },
    });
  },
);
