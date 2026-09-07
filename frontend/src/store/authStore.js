import { create } from "zustand";
import { useShallow } from "zustand/react/shallow";
import { getToken, saveToken as persistToken, clearToken as removeToken } from "../utils/auth.js";
import { apiGet } from "../utils/apiClient.js";

const useAuthStore = create((set, get) => ({
  user: null,
  token: getToken(),
  isLoading: false,
  isInitialized: false,

  setUser: (user) => set({ user }),

  setToken: (token) => {
    persistToken(token);
    set({ token });
  },

  clearSession: () => {
    removeToken();
    set({ user: null, token: null, isInitialized: true });
  },

  fetchCurrentUser: async () => {
    const token = get().token;
    if (!token) {
      set({ isInitialized: true });
      return null;
    }

    set({ isLoading: true });
    try {
      const user = await apiGet("/api/auth/me");
      set({ user, isLoading: false, isInitialized: true });
      return user;
    } catch (error) {
      set({ user: null, isLoading: false, isInitialized: true });
      return null;
    }
  },
}));

export const useUser = () => useAuthStore((state) => state.user);
export const useAuthToken = () => useAuthStore((state) => state.token);
export const useIsAuthLoading = () => useAuthStore((state) => state.isLoading);
export const useIsAuthInitialized = () => useAuthStore((state) => state.isInitialized);
export const useAuthActions = () =>
  useAuthStore(
    useShallow((state) => ({
      setUser: state.setUser,
      setToken: state.setToken,
      clearSession: state.clearSession,
      fetchCurrentUser: state.fetchCurrentUser,
    }))
  );

export default useAuthStore;
