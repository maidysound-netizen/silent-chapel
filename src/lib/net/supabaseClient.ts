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

/**
 * 같은 브라우저의 탭 두 개는 로그인 세션을 공유해 '같은 사람'이 됩니다.
 * 멀티플레이 테스트용으로 ?profile=a / ?profile=b 를 붙이면 탭마다 다른 익명 방문자가 됩니다.
 * (실제 서비스에서도 무해: 단지 다른 익명 계정을 하나 더 쓰는 것)
 */
function authStorageKey(): string {
  if (typeof window === "undefined") return "silent-chapel-auth";
  const profile = new URLSearchParams(window.location.search).get("profile");
  return profile && /^[a-z0-9]{1,16}$/.test(profile) ? `silent-chapel-auth-${profile}` : "silent-chapel-auth";
}

export function getSupabase(): SupabaseClient | null {
  if (client !== undefined) return client;
  const env = readSupabaseEnv();
  client = env
    ? createClient(env.url, env.key, {
        auth: { persistSession: true, autoRefreshToken: true, storageKey: authStorageKey() },
        realtime: { params: { eventsPerSecond: 20 } },
      })
    : null;
  return client;
}
