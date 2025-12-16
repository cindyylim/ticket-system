import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { apiService } from '../services/api.service';
import './Checkout.css';

function Checkout() {
    const location = useLocation();
    const navigate = useNavigate();
    const { eventId, seatIds, lockIds, expiresIn } = location.state || {};
    const [timeLeft, setTimeLeft] = useState(expiresIn || 600);
    const [confirming, setConfirming] = useState(false);

    useEffect(() => {
        if (!eventId || !seatIds || !lockIds) {
            navigate('/');
            return;
        }

        const timer = setInterval(() => {
            setTimeLeft((prev: number) => {
                if (prev <= 1) {
                    clearInterval(timer);
                    alert('Your lock has expired. Please try again.');
                    navigate(`/events/${eventId}/seats`);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, []);

    const handleConfirmBooking = async () => {
        if (confirming) return;

        setConfirming(true);
        try {
            const result = await apiService.confirmBooking(eventId, seatIds, lockIds);
            alert(`Booking confirmed! Booking ID: ${result.bookingId}`);
            navigate('/my-bookings');
        } catch (error: any) {
            alert(error.response?.data?.error || 'Failed to confirm booking');
            setConfirming(false);
        }
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <div className="checkout">
            <div className="container">
                <div className="checkout-layout">
                    <div className="checkout-main">
                        <h1>Complete Your Booking</h1>

                        <div className="timer-warning">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm.5-13H11v6l5.2 3.2.8-1.3-4.5-2.7V7z" />
                            </svg>
                            <span>Seats locked for: <strong>{formatTime(timeLeft)}</strong></span>
                        </div>

                        <div className="card">
                            <h3>Payment Information</h3>
                            <p style={{ color: 'var(--text-secondary)' }}>
                                This is a demo. Click "Confirm Booking" to complete your purchase.
                            </p>
                        </div>
                    </div>

                    <div className="checkout-sidebar">
                        <div className="card">
                            <h3>Booking Summary</h3>
                            <div className="summary-item">
                                <span>Seats:</span>
                                <span>{seatIds?.length || 0} tickets</span>
                            </div>
                            <button
                                className="btn btn-success btn-block"
                                onClick={handleConfirmBooking}
                                disabled={confirming}
                            >
                                {confirming ? 'Processing...' : 'Confirm Booking'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Checkout;
