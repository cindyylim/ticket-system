import axios, { AxiosInstance } from 'axios';

class ApiService {
    private api: AxiosInstance;

    constructor() {
        this.api = axios.create({
            baseURL: 'http://localhost:5000/api',
            headers: {
                'Content-Type': 'application/json',
            },
        });

        // Add auth token to requests
        this.api.interceptors.request.use((config) => {
            const token = localStorage.getItem('token');
            if (token) {
                config.headers.Authorization = `Bearer ${token}`;
            }
            return config;
        });
    }

    // Auth
    async register(email: string, password: string, name: string) {
        const { data } = await this.api.post('/auth/register', { email, password, name });
        return data;
    }

    async login(email: string, password: string) {
        const { data } = await this.api.post('/auth/login', { email, password });
        return data;
    }

    // Events
    async getEvents(params?: { page?: number; category?: string; search?: string }) {
        const { data } = await this.api.get('/events', { params });
        return data;
    }

    async getEvent(id: string) {
        const { data } = await this.api.get(`/events/${id}`);
        return data;
    }

    async getEventSeats(id: string) {
        const { data } = await this.api.get(`/events/${id}/seats`);
        return data;
    }

    // Venues
    async getVenues() {
        const { data } = await this.api.get('/venues');
        return data;
    }

    async getVenue(id: string) {
        const { data } = await this.api.get(`/venues/${id}`);
        return data;
    }

    // Performers
    async getPerformers(genre?: string) {
        const { data } = await this.api.get('/performers', { params: { genre } });
        return data;
    }

    async getPerformer(id: string) {
        const { data } = await this.api.get(`/performers/${id}`);
        return data;
    }

    // Bookings
    async lockSeats(eventId: string, seatIds: string[]) {
        const { data } = await this.api.post('/bookings/lock', { eventId, seatIds });
        return data;
    }

    async confirmBooking(eventId: string, seatIds: string[], lockIds: { [seatId: string]: string }) {
        const { data } = await this.api.post('/bookings/confirm', { eventId, seatIds, lockIds });
        return data;
    }

    async unlockSeats(seatIds: string[], lockIds: { [seatId: string]: string }) {
        const { data } = await this.api.post('/bookings/unlock', { seatIds, lockIds });
        return data;
    }

    async getMyBookings() {
        const { data } = await this.api.get('/bookings/my-bookings');
        return data;
    }

    // Queue
    async getQueueStatus(eventId: string) {
        const { data } = await this.api.get(`/queue/status/${eventId}`);
        return data;
    }
}

export const apiService = new ApiService();
