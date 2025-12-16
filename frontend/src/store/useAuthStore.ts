import { create } from 'zustand';

interface User {
    id: string;
    email: string;
    name: string;
}

interface AuthState {
    user: User | null;
    token: string | null;
    loading: boolean;
    isAuthenticated: boolean;
    login: (userData: { token: string; user: User }) => void;
    logout: () => void;
    initialize: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
    user: null,
    token: null,
    loading: true,
    isAuthenticated: false,

    login: (userData) => {
        localStorage.setItem('token', userData.token);
        localStorage.setItem('user', JSON.stringify(userData.user));
        set({
            token: userData.token,
            user: userData.user,
            isAuthenticated: true,
        });
    },

    logout: () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        set({
            token: null,
            user: null,
            isAuthenticated: false,
        });
    },

    initialize: () => {
        const token = localStorage.getItem('token');
        const userStr = localStorage.getItem('user');
        let user: User | null = null;

        if (token && userStr) {
            try {
                user = JSON.parse(userStr);
            } catch (e) {
                console.error('Failed to parse user from localStorage', e);
            }
        }

        set({
            token,
            user,
            isAuthenticated: !!(token && user),
            loading: false,
        });
    },
}));
