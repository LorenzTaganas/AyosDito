import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  type ReactNode,
} from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { AuthResponse, AuthUser, MeResponse } from '@shared/api-types';
import type { LoginInput } from '@shared/contracts';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  refresh: () => Promise<void>;
  setUser: (user: AuthUser | null) => void;
  login: (input: LoginInput) => Promise<AuthUser>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const meQuery = useQuery({
    queryKey: queryKeys.auth,
    queryFn: async () => {
      const data = await api.get<MeResponse>('/auth/me');
      return data.user;
    },
    staleTime: 60_000,
    retry: false,
  });

  const setUser = useCallback(
    (user: AuthUser | null) => {
      queryClient.setQueryData<AuthUser | null>(queryKeys.auth, user);
    },
    [queryClient],
  );

  const refresh = useCallback(async () => {
    await queryClient.refetchQueries({ queryKey: queryKeys.auth, exact: true });
  }, [queryClient]);

  const login = useCallback(
    async (input: LoginInput) => {
      const result = await api.post<AuthResponse>('/auth/login', input);
      setUser(result.user);
      await queryClient.invalidateQueries({ queryKey: queryKeys.auth });
      return result.user;
    },
    [queryClient, setUser],
  );

  const logout = useCallback(async () => {
    await api.post('/auth/logout');
    setUser(null);
    queryClient.removeQueries({ queryKey: queryKeys.auth });
    queryClient.clear();
  }, [queryClient, setUser]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user: meQuery.data ?? null,
      isLoading: meQuery.isPending,
      refresh,
      setUser,
      login,
      logout,
    }),
    [meQuery.data, meQuery.isPending, refresh, setUser, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider.');
  return context;
}

export function useDocumentTitle(title: string | null | undefined) {
  useEffect(() => {
    document.title = title ? `${title} — AyosDito` : 'AyosDito — May sira? May maaasahang aayos!';
  }, [title]);
}
