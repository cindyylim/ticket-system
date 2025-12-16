import React, { useEffect, useState } from 'react';
import { apiService } from '../services/api.service';

interface QueueModalProps {
    eventId: string;
    isOpen: boolean;
    onProceed: () => void;
    onClose: () => void;
}

const QueueModal: React.FC<QueueModalProps> = ({ eventId, isOpen, onProceed, onClose }) => {
    const [position, setPosition] = useState<number | null>(null);
    const [waitTime, setWaitTime] = useState<number | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let intervalId: ReturnType<typeof setInterval>;

        const checkStatus = async () => {
            try {
                const status = await apiService.getQueueStatus(eventId);

                if (status.canProceed) {
                    onProceed();
                    return;
                }

                if (status.position > 0) {
                    setPosition(status.position);
                    setWaitTime(status.estimatedWaitTime);
                    setLoading(false);
                } else {
                    // Not in queue anymore (maybe removed or error)
                    onClose();
                }
            } catch (error) {
                console.error('Error checking queue status:', error);
            }
        };

        if (isOpen) {
            checkStatus(); // Initial check
            intervalId = setInterval(checkStatus, 3000); // Poll every 3 seconds
        }

        return () => {
            if (intervalId) clearInterval(intervalId);
        };
    }, [eventId, isOpen, onProceed, onClose]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 left-0 top-0 w-full h-full">
            <div className="bg-[#1e2330] border border-white/10 rounded-2xl max-w-md w-full p-8 text-center relative overflow-hidden shadow-2xl">
                {/* Background glow effect */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-1/2 bg-blue-500/20 blur-[60px] rounded-full" />

                <div className="relative z-10">
                    <div className="w-16 h-16 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                        <div className="w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    </div>

                    <h2 className="text-2xl font-bold text-white mb-2">You are in line</h2>
                    <p className="text-gray-400 mb-8">
                        Ideally, we'd let you right in. But lots of fans are trying to buy tickets right now.
                    </p>

                    <div className="grid grid-cols-2 gap-4 mb-8">
                        <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                            <div className="text-sm text-gray-400 mb-1">People Ahead</div>
                            <div className="text-2xl font-bold text-white">
                                {loading ? '-' : position}
                            </div>
                        </div>
                        <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                            <div className="text-sm text-gray-400 mb-1">Est. Wait Time</div>
                            <div className="text-2xl font-bold text-white">
                                {loading ? '-' : `${Math.ceil((waitTime || 0) / 1000 / 60)} minutes`}
                            </div>
                        </div>
                    </div>

                    <button
                        onClick={onClose}
                        className="text-sm text-gray-500 hover:text-white transition-colors"
                    >
                        Leave Queue
                    </button>

                    <div className="mt-8 text-xs text-gray-500">
                        Do not refresh this page. You will be redirected automatically.
                    </div>
                </div>
            </div>
        </div>);
};

export default QueueModal;
