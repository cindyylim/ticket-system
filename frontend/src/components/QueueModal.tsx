import { useEffect, useState } from 'react';
import { apiService } from '../services/api.service';
import './QueueModal.css';

interface QueueModalProps {
    eventId: string;
    isOpen: boolean;
    onProceed: () => void;
    onClose: () => void;
}

const QueueModal = ({ eventId, isOpen, onProceed, onClose }: QueueModalProps) => {
    const [position, setPosition] = useState<number | null>(null);
    const [waitTime, setWaitTime] = useState<number | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let intervalId: ReturnType<typeof setInterval>;
        let cancelled = false;

        const checkStatus = async () => {
            try {
                const status = await apiService.getQueueStatus(eventId);
                if (cancelled) return;

                if (status.canProceed) {
                    onProceed();
                    return;
                }

                if (status.position > 0) {
                    setPosition(status.position);
                    setWaitTime(status.estimatedWaitTime);
                    setLoading(false);
                } else {
                    onClose();
                }
            } catch (error) {
                console.error('Error checking queue status:', error);
            }
        };

        if (isOpen) {
            checkStatus();
            intervalId = setInterval(checkStatus, 3000);
        }

        return () => {
            cancelled = true;
            if (intervalId) clearInterval(intervalId);
        };
    }, [eventId, isOpen, onProceed, onClose]);

    const handleLeave = async () => {
        try {
            await apiService.leaveQueue(eventId);
        } catch (error) {
            console.error('Error leaving queue:', error);
        }
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="queue-modal-overlay">
            <div className="queue-modal">
                <div className="queue-modal-spinner" />
                <h2>You are in line</h2>
                <p className="queue-modal-copy">
                    High demand right now. You will move forward automatically as people finish booking.
                </p>

                <div className="queue-modal-stats">
                    <div className="queue-modal-stat">
                        <div className="queue-modal-stat-label">People ahead</div>
                        <div className="queue-modal-stat-value">{loading ? '—' : position}</div>
                    </div>
                    <div className="queue-modal-stat">
                        <div className="queue-modal-stat-label">Est. wait</div>
                        <div className="queue-modal-stat-value">
                            {loading ? '—' : `${Math.ceil((waitTime || 0) / 1000 / 60)} min`}
                        </div>
                    </div>
                </div>

                <button type="button" className="queue-modal-leave" onClick={handleLeave}>
                    Leave queue
                </button>
                <div className="queue-modal-hint">Stay on this page. You will be let in automatically.</div>
            </div>
        </div>
    );
};

export default QueueModal;
