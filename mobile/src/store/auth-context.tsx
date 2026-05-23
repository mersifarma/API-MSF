import {
  createContext,
  useContext,
  useEffect,
  useState,
  type PropsWithChildren,
} from "react";
import * as AuthService from "../services/auth.service";
import { setStorageItemAsync, useStorageState } from "../lib/use-storage-state";
import type { Pegawai, User } from "../types/api";

export const LAST_LOGIN_KEY = "last_login_at";

type AuthState = {
  user: User | null;
  pegawai: Pegawai | null;
  pegawaiList: Pegawai[];
  token: string | null;
  isLoading: boolean;
};

type AuthContextValue = AuthState & {
  signIn: (username: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  switchPegawai: (idPeg: number) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error("useAuth must be used inside <AuthProvider>");
  }
  return value;
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [[tokenLoading, token], setToken] = useStorageState("auth_token");

  const [user, setUser] = useState<User | null>(null);
  const [pegawai, setPegawai] = useState<Pegawai | null>(null);
  const [pegawaiList, setPegawaiList] = useState<Pegawai[]>([]);
  const [bootstrapping, setBootstrapping] = useState(false);

  // Rehydrate user data from /me whenever token loads from secure-store.
  useEffect(() => {
    if (tokenLoading) return;
    if (!token) {
      setUser(null);
      setPegawai(null);
      setPegawaiList([]);
      return;
    }

    let cancelled = false;
    setBootstrapping(true);
    AuthService.me(token)
      .then((data) => {
        if (cancelled) return;
        setUser(data.user);
        setPegawai(data.pegawai);
        setPegawaiList(data.pegawaiList);
      })
      .catch(() => {
        if (cancelled) return;
        // Token invalid / network down — clear it so user goes back to login.
        setToken(null);
      })
      .finally(() => {
        if (!cancelled) setBootstrapping(false);
      });

    return () => {
      cancelled = true;
    };
  }, [token, tokenLoading, setToken]);

  const signIn: AuthContextValue["signIn"] = async (username, password) => {
    const data = await AuthService.login({ username, password });
    setUser(data.user);
    setPegawai(data.pegawai);
    setPegawaiList(data.pegawaiList);
    setToken(data.access_token);
    await setStorageItemAsync(LAST_LOGIN_KEY, new Date().toISOString());
  };

  const signOut: AuthContextValue["signOut"] = async () => {
    const currentToken = token;
    setUser(null);
    setPegawai(null);
    setPegawaiList([]);
    setToken(null);
    await setStorageItemAsync(LAST_LOGIN_KEY, null);
    if (currentToken) {
      try {
        await AuthService.logout(currentToken);
      } catch {
        // ignore — local state sudah ter-clear.
      }
    }
  };

  const switchPegawai: AuthContextValue["switchPegawai"] = async (idPeg) => {
    if (!token) throw new Error("Not authenticated");
    const data = await AuthService.switchPegawai(token, idPeg);
    setUser(data.user);
    setPegawai(data.pegawai);
    setToken(data.access_token);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        pegawai,
        pegawaiList,
        token,
        isLoading: tokenLoading || bootstrapping,
        signIn,
        signOut,
        switchPegawai,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
