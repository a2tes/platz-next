"use client";

import { createContext, useContext, useEffect, ReactNode } from "react";
import { useAuthStore } from "../stores/authStore";
import { AuthService } from "../services/authService";
import { User, LoginCredentials } from "../types/auth";

interface AuthContextType {
	user: User | null;
	isAuthenticated: boolean;
	isLoading: boolean;
	error: string | null;
	login: (credentials: LoginCredentials) => Promise<void>;
	logout: () => Promise<void>;
	refreshToken: () => Promise<void>;
	clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
	children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
	// Select specific store slices for render
	const userState = useAuthStore((s) => s.user);
	const isAuthenticatedState = useAuthStore((s) => s.isAuthenticated);
	const isLoadingState = useAuthStore((s) => s.isLoading);
	const errorState = useAuthStore((s) => s.error);
	const loginAction = useAuthStore((s) => s.login);
	const logoutAction = useAuthStore((s) => s.logout);
	const refreshTokenAction = useAuthStore((s) => s.refreshToken);
	const clearErrorAction = useAuthStore((s) => s.clearError);
	const accessToken = useAuthStore((s) => s.accessToken);

	// Initialize auth state on mount (run once)
	useEffect(() => {
		const initializeAuth = async () => {
			const token = AuthService.getAccessToken();
			if (!token) {
				// Set loading to false when no token found
				useAuthStore.getState().setLoading(false);
				return;
			}

			// Check if token is expired
			if (AuthService.isTokenExpired(token)) {
				try {
					await useAuthStore.getState().refreshToken();
				} catch (error) {
					// Refresh failed, user will need to login again
					console.warn("Token refresh failed during initialization", error);
				}
				return;
			}

			// Token is valid, get current user
			try {
				useAuthStore.getState().setLoading(true);
				const { user } = await AuthService.getCurrentUser();

				// Update store with current user data
				useAuthStore.setState({
					user,
					accessToken: token,
					isAuthenticated: true,
					isLoading: false,
					error: null,
				});
			} catch {
				// Failed to get user, try to refresh token
				try {
					await useAuthStore.getState().refreshToken();
				} catch {
					// Both failed, clear auth state
					AuthService.removeAccessToken();
					useAuthStore.setState({
						user: null,
						accessToken: null,
						isAuthenticated: false,
						isLoading: false,
						error: null,
					});
				}
			}
		};

		initializeAuth();
	}, []);

	// Set up token refresh interval
	useEffect(() => {
		if (!isAuthenticatedState || !accessToken) {
			return;
		}

		const token = accessToken;
		const expiration = AuthService.getTokenExpiration(token);

		if (!expiration) {
			return;
		}

		// Refresh token 5 minutes before expiration
		const refreshTime = expiration.getTime() - Date.now() - 5 * 60 * 1000;

		if (refreshTime <= 0) {
			// Token expires soon, refresh immediately
			useAuthStore
				.getState()
				.refreshToken()
				.catch(() => {
					// Refresh failed, user will need to login again
				});
			return;
		}

		const refreshTimer = setTimeout(() => {
			useAuthStore
				.getState()
				.refreshToken()
				.catch(() => {
					// Refresh failed, user will need to login again
				});
		}, refreshTime);

		return () => clearTimeout(refreshTimer);
	}, [accessToken, isAuthenticatedState]);

	const contextValue: AuthContextType = {
		user: userState,
		isAuthenticated: isAuthenticatedState,
		isLoading: isLoadingState,
		error: errorState,
		login: loginAction,
		logout: logoutAction,
		refreshToken: refreshTokenAction,
		clearError: clearErrorAction,
	};

	return (
		<AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>
	);
}

export function useAuthContext() {
	const context = useContext(AuthContext);
	if (context === undefined) {
		throw new Error("useAuthContext must be used within an AuthProvider");
	}
	return context;
}

// Re-export the hook from the store for convenience
export { useAuth } from "../stores/authStore";
