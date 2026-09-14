import { useEffect, useState, useCallback, useRef } from 'react';

interface UseSSEOptions {
    onMessage?: (data: any) => void;
    onError?: (error: Event) => void;
}

export const useSSE = (eventId: string | null, options?: UseSSEOptions) => {
    const [connected, setConnected] = useState(false);
    const [lastMessage, setLastMessage] = useState<any>(null);

    const optionsRef = useRef(options);

    useEffect(() => {
        optionsRef.current = options;
    }, [options]);

    const connect = useCallback(() => {
        if (!eventId) return;

        const eventSource = new EventSource(`/api/sse/events/${eventId}/seats`);

        eventSource.onopen = () => {
            setConnected(true);
        };

        eventSource.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                setLastMessage(data);
                optionsRef.current?.onMessage?.(data);
            } catch (error) {
                console.error('Failed to parse SSE message:', error);
            }
        };

        eventSource.onerror = (error) => {
            setConnected(false);
            optionsRef.current?.onError?.(error);
            // Do not close — the browser retries the stream automatically.
        };

        return eventSource;
    }, [eventId]);

    useEffect(() => {
        const eventSource = connect();
        return () => {
            eventSource?.close();
        };
    }, [connect]);

    return { connected, lastMessage };
};
