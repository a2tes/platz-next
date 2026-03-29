import axios from "axios";
import { AuthService } from "../services/authService";

const API_URL =
	`${process.env.NEXT_PUBLIC_PROTOCOL}://api.${process.env.NEXT_PUBLIC_HOSTNAME}` ||
	`http://localhost:${process.env.NEXT_PUBLIC_PORT || "5051"}`;

export const api = axios.create({
	baseURL: API_URL,
	timeout: 10000,
	headers: {
		"Content-Type": "application/json",
	},
	withCredentials: true, // Include cookies for refresh token
});

// Request interceptor for auth token
api.interceptors.request.use(
	(config) => {
		// Add auth token if available
		const token = AuthService.getAccessToken();
		if (token) {
			config.headers.Authorization = `Bearer ${token}`;
		}
		return config;
	},
	(error) => {
		return Promise.reject(error);
	}
);

// Response interceptor for error handling and token refresh
api.interceptors.response.use(
	(response) => response,
	async (error) => {
		const originalRequest = error.config || {};

		const url: string = (originalRequest.url || "").toString();

		// Do not attempt refresh for auth endpoints themselves to avoid loops
		const isAuthEndpoint = [
			"/api/auth/login",
			"/api/auth/refresh",
			"/api/auth/logout",
			"/api/auth/logout-all",
		].some((path) => url.includes(path));

		if (
			error.response?.status === 401 &&
			!isAuthEndpoint &&
			!originalRequest._retry
		) {
			originalRequest._retry = true;

			try {
				// Try to refresh the token
				const response = await axios.post(
					`${API_URL}/api/auth/refresh`,
					{},
					{
						withCredentials: true,
					}
				);

				const { accessToken } = response.data.data;
				AuthService.setAccessToken(accessToken);

				// Retry the original request with new token
				originalRequest.headers = originalRequest.headers || {};
				originalRequest.headers.Authorization = `Bearer ${accessToken}`;
				return api(originalRequest);
			} catch (refreshError) {
				// Refresh failed, clear token and redirect to login
				if (typeof window !== "undefined") {
					AuthService.removeAccessToken();
					window.location.href = "/login";
				}
				return Promise.reject(refreshError);
			}
		}

		return Promise.reject(error);
	}
);

export default api;
