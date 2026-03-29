import { create } from "zustand";
import { persist } from "zustand/middleware";
import { AuthStore, LoginCredentials } from "../types/auth";
import { AuthService } from "../services/authService";

// Flag to track if hydration has completed
let hydrationChecked = false;

export const useAuthStore = create<AuthStore>()(
	persist(
		(set, get) => ({
			// State
			user: null,
			accessToken: null,
			isAuthenticated: false,
			isLoading: true, // Start with loading true during hydration
			error: null,

			// Actions
			login: async (credentials: LoginCredentials) => {
				set({ isLoading: true, error: null });

				try {
					const response = await AuthService.login(credentials);
					const { user, accessToken } = response.data;

					// Store token
					AuthService.setAccessToken(accessToken);

					set({
						user,
						accessToken,
						isAuthenticated: true,
						isLoading: false,
						error: null,
					});
				} catch (error) {
					set({
						user: null,
						accessToken: null,
						isAuthenticated: false,
						isLoading: false,
						error: error instanceof Error ? error.message : "Login failed",
					});
					throw error;
				}
			},

			logout: async () => {
				set({ isLoading: true });

				try {
					await AuthService.logout();
				} catch (error) {
					console.warn("Logout request failed:", error);
				} finally {
					// Clear local state regardless of API call result
					AuthService.removeAccessToken();
					set({
						user: null,
						accessToken: null,
						isAuthenticated: false,
						isLoading: false,
						error: null,
					});
				}
			},

			refreshToken: async () => {
				try {
					const response = await AuthService.refreshToken();
					const { user, accessToken } = response.data;

					// Store new token
					AuthService.setAccessToken(accessToken);

					set({
						user,
						accessToken,
						isAuthenticated: true,
						error: null,
					});
				} catch (error) {
					// If refresh fails, logout user
					AuthService.removeAccessToken();
					set({
						user: null,
						accessToken: null,
						isAuthenticated: false,
						error: "Session expired",
					});
					throw error;
				}
			},

			clearError: () => {
				set({ error: null });
			},

			setLoading: (loading: boolean) => {
				set({ isLoading: loading });
			},

			// Initialize auth state after hydration
			initializeAuth: async () => {
				if (hydrationChecked) return;
				hydrationChecked = true;

				set({ isLoading: true });

				// If we already have an authenticated session in memory (e.g., just logged in)
				// and a token in localStorage, avoid immediately calling refresh/me which can
				// race with cookie writes from login.
				const state = get();
				const existingToken = AuthService.getAccessToken();
				if (state.isAuthenticated && state.user && existingToken) {
					set({ isLoading: false, error: null });
					return;
				}

				try {
					// Check if token exists in localStorage
					const token = AuthService.getAccessToken();

					if (!token) {
						// No token, user is not authenticated
						set({
							user: null,
							accessToken: null,
							isAuthenticated: false,
							isLoading: false,
							error: null,
						});
						return;
					}

					// Check if token is expired
					if (AuthService.isTokenExpired(token)) {
						// Token expired, try to refresh
						try {
							await get().refreshToken();
							set({ isLoading: false });
						} catch {
							set({
								user: null,
								accessToken: null,
								isAuthenticated: false,
								isLoading: false,
								error: "Session expired",
							});
						}
						return;
					} // Token is valid, verify with backend
					try {
						const response = await AuthService.getCurrentUser();
						set({
							user: response.user,
							isAuthenticated: true,
							isLoading: false,
							error: null,
						});
					} catch {
						// Token is invalid on backend, clear it
						AuthService.removeAccessToken();
						set({
							user: null,
							accessToken: null,
							isAuthenticated: false,
							isLoading: false,
							error: "Session invalid",
						});
					}
				} catch (error) {
					console.error("Auth initialization error:", error);
					set({
						user: null,
						accessToken: null,
						isAuthenticated: false,
						isLoading: false,
						error:
							error instanceof Error ? error.message : "Initialization failed",
					});
				}
			},
		}),
		{
			name: "auth-storage",
			partialize: (state) => ({
				user: state.user,
				isAuthenticated: state.isAuthenticated,
			}),
		}
	)
);

// Helper hooks
export const useAuth = () => {
	const store = useAuthStore();
	return {
		user: store.user,
		isAuthenticated: store.isAuthenticated,
		isLoading: store.isLoading,
		error: store.error,
		login: store.login,
		logout: store.logout,
		refreshToken: store.refreshToken,
		clearError: store.clearError,
	};
};

export const useUser = () => {
	const user = useAuthStore((state) => state.user);
	return user;
};

export const useIsAuthenticated = () => {
	const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
	return isAuthenticated;
};
