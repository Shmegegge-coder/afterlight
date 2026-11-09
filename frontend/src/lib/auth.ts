import { useQuery } from "@tanstack/react-query";
import { apiGet, apiPost } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";

export interface Session {
  email: string;
}

export const SESSION_KEY = ["auth", "me"] as const;

/** Staff session. data = null when logged out. */
export function useSession() {
  return useQuery({
    queryKey: SESSION_KEY,
    queryFn: async (): Promise<Session | null> => {
      const s = await apiGet<{ email: string | null }>("/auth/me");
      return s.email ? { email: s.email } : null;
    },
    retry: false,
    staleTime: 60_000,
  });
}

export async function login(email: string, password: string): Promise<Session> {
  const s = await apiPost<Session>("/auth/login", { email, password });
  queryClient.clear();
  queryClient.setQueryData(SESSION_KEY, s);
  return s;
}

export async function logout(): Promise<void> {
  await apiPost("/auth/logout");
  queryClient.clear();
  queryClient.setQueryData(SESSION_KEY, null);
}
