import { createClient } from "@supabase/supabase-js";
import type { ClientDatabase } from "@/types/clientDatabase";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// 설정이나 서버가 없어도 정적 월드는 열 수 있다.
export const supabase = (() => {
  if (!url || !key) return null;
  try {
    return createClient<ClientDatabase>(url, key, {
      global: {
        fetch: (input, init) => fetch(input, {
          ...init,
          signal: init?.signal
            ? AbortSignal.any([init.signal, AbortSignal.timeout(8000)])
            : AbortSignal.timeout(8000),
        }),
      },
    });
  } catch {
    return null;
  }
})();
