export interface User {
	id: number;
	email: string;
	name: string;
	role: "ADMIN" | "EDITOR" | "VIEWER";
	avatarUrl?: string | null;
	createdAt: string;
	updatedAt: string;
}

export interface LoginCredentials {
	email: string;
	password: string;
	rememberMe?: boolean;
}

export interface AuthResponse {
	success: boolean;
	data: {
		user: User;
		accessToken: string;
		expiresIn: number;
	};
}

export interface RefreshResponse {
	success: boolean;
	data: {
		user: User;
		accessToken: string;
		expiresIn: number;
	};
}

export interface ApiError {
	success: false;
	error: {
		code: string;
		message: string;
		timestamp: string;
	};
}

export interface AuthState {
	user: User | null;
	accessToken: string | null;
	isAuthenticated: boolean;
	isLoading: boolean;
	error: string | null;
}

export interface AuthActions {
	login: (credentials: LoginCredentials) => Promise<void>;
	logout: () => Promise<void>;
	refreshToken: () => Promise<void>;
	clearError: () => void;
	setLoading: (loading: boolean) => void;
	initializeAuth: () => Promise<void>;
}

export type AuthStore = AuthState & AuthActions;
