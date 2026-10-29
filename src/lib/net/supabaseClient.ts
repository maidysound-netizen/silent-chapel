// Supabase 클라이언트. 환경 변수가 없으면 null을 돌려주고 앱은 '혼자 머무는 모드'로 동작합니다.
// 여기에는 브라우저에 공개되어도 되는 anon/publishable 키만 사용합니다. service_role 키는 절대 넣지 마세요.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null | undefined;

export interface SupabaseEnv {
  url: string;
  key: string;
  privateChannels: boolean;
  messageBudget: number;
}

export function readSupabaseEnv(): SupabaseEnv | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  const budget = Number(process.env.NEXT_PUBLIC_REALTIME_MSG_BUDGET);
  return {
    url,
    key,
    privateChannels: process.env.NEXT_PUBLIC_REALTIME_PRIVATE !== "false",
    messageBudget: Number.isFinite(budget) && budget > 0 ? budget : 80,
  };
}

export function getSupabase(): SupabaseClient | null {
  if (client !== undefined) return client;
  const env = readSupabaseEnv();
  client = env
    ? createClient(env.url, env.key, {
        auth: { persistSession: true, autoRefreshToken: true, storageKey: "silent-chapel-auth" },
        realtime: { params: { eventsPerSecond: 20 } },
      })
    : null;
  return client;
}
