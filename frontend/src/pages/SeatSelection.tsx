import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiService } from '../services/api.service';
import { useSSE } from '../hooks/useSSE';
import { useAuth } from '../hooks/useAuth';
import QueueModal from '../components/QueueModal';
import './SeatSelection.css';

interface Seat {
    _id: string;
    section: string;
    row: number;
    seatNumber: number;
    price: number;
    status: 'available' | 'locked' | 'booked';
}

function SeatSelection() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { isAuthenticated } = useAuth();
    const [seats, setSeats] = useState<Seat[]>([]);
    const [selectedSeats, setSelectedSeats] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [showQueueModal, setShowQueueModal] = useState(false);

    // Real-time SSE updates
    useSSE(id || null, {
        onMessage: (data) => {
            if (data.type === 'seatUpdate') {
                const updatesMap = new Map<string, Seat>(data.seats.map((s: Seat) => [s._id, s]));

                setSeats((prevSeats) =>
                    prevSeats.map((seat) => {
                        const updatedSeat = updatesMap.get(seat._id);
                        return updatedSeat ? updatedSeat : seat;
                    })
                );
            }
        },
    });

    useEffect(() => {
        if (id) loadSeats();
    }, [id]);

    useEffect(() => {
        setSelectedSeats((prev) =>
            prev.filter(id => {
                const seat = seats.find(s => s._id === id);
                return seat?.status === 'available';
            })
        );
    }, [seats]);

    const loadSeats = async () => {
        try {
            const data = await apiService.getEventSeats(id!);
            setSeats(data);
        } catch (error) {
            console.error('Failed to load seats:', error);
        } finally {
            setLoading(false);
        }
    };

    const toggleSeat = (seatId: string, status: string) => {
        if (status !== 'available') return;

        setSelectedSeats((prev) =>
            prev.includes(seatId)
                ? prev.filter((id) => id !== seatId)
                : [...prev, seatId]
        );
    };

    const handleLockSeats = async () => {
        if (!isAuthenticated) {
            navigate('/login');
            return;
        }

        if (selectedSeats.length === 0) {
            alert('Please select at least one seat');
            return;
        }

        try {
            const result = await apiService.lockSeats(id!, selectedSeats);
            if (result.queued) {
                setShowQueueModal(true);
            } else if (result.success) {
                // Navigate to checkout with lock info
                navigate('/checkout', {
                    state: {
                        eventId: id,
                        seatIds: selectedSeats,
                        lockIds: result.lockIds,
                        expiresIn: result.expiresIn,
                    },
                });
            }
        } catch (error: any) {
            alert(error.response?.data?.error || 'Failed to lock seats');
        }
    };

    const handleQueueProceed = () => {
        setShowQueueModal(false);
        // Retry locking seats automatically
        handleLockSeats();
    };

    // Group seats by section and then by row
    const seatsBySection = seats.reduce((acc, seat) => {
        if (!acc[seat.section]) {
            acc[seat.section] = {};
        }
        if (!acc[seat.section][seat.row]) {
            acc[seat.section][seat.row] = [];
        }
        acc[seat.section][seat.row].push(seat);
        return acc;
    }, {} as Record<string, Record<number, Seat[]>>);

    const totalPrice = selectedSeats.reduce((sum, seatId) => {
        const seat = seats.find((s) => s._id === seatId);
        return sum + (seat?.price || 0);
    }, 0);

    if (loading) {
        return (
            <div className="loading-container">
                <div className="spinner"></div>
            </div>
        );
    }

    return (
        <div className="seat-selection">
            <QueueModal
                eventId={id!}
                isOpen={showQueueModal}
                onProceed={handleQueueProceed}
                onClose={() => setShowQueueModal(false)}
            />

            <div className="container">
                <h1>Select Your Seats</h1>
                <p className="subtitle">Real-time availability • Seats update live as others book</p>

                <div className="seat-selection-layout">
                    <div className="seat-map">
                        {Object.entries(seatsBySection).map(([section, sectionRows]) => (
                            <div key={section} className="section">
                                <h3 className="section-title">{section}</h3>
                                <div className="rows-container">
                                    {Object.entries(sectionRows)
                                        .sort(([rowA], [rowB]) => parseInt(rowA) - parseInt(rowB))
                                        .map(([row, rowSeats]) => (
                                            <div key={row} className="row">
                                                <div className="row-label">Row {row}</div>
                                                <div className="seats-grid">
                                                    {rowSeats
                                                        .sort((a, b) => a.seatNumber - b.seatNumber)
                                                        .map((seat) => (
                                                            <button
                                                                key={seat._id}
                                                                className={`seat seat-${seat.status} ${selectedSeats.includes(seat._id) ? 'seat-selected' : ''
                                                                    }`}
                                                                onClick={() => toggleSeat(seat._id, seat.status)}
                                                                disabled={seat.status !== 'available'}
                                                                title={`Row ${seat.row}, Seat ${seat.seatNumber} - $${seat.price}`}
                                                            >
                                                                {seat.seatNumber}
                                                            </button>
                                                        ))}
                                                </div>
                                            </div>
                                        ))}
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="selection-sidebar">
                        <div className="card">
                            <h3>Your Selection</h3>

                            <div className="legend">
                                <div className="legend-item">
                                    <span className="seat-demo seat-available"></span>
                                    <span>Available</span>
                                </div>
                                <div className="legend-item">
                                    <span className="seat-demo seat-selected"></span>
                                    <span>Selected</span>
                                </div>
                                <div className="legend-item">
                                    <span className="seat-demo seat-locked"></span>
                                    <span>Locked</span>
                                </div>
                                <div className="legend-item">
                                    <span className="seat-demo seat-booked"></span>
                                    <span>Unavailable</span>
                                </div>
                            </div>

                            <div className="selection-summary">
                                <p><strong>{selectedSeats.length}</strong> seat(s) selected</p>
                                <p className="total-price">${totalPrice.toFixed(2)}</p>
                            </div>

                            <button
                                className="btn btn-primary btn-block"
                                onClick={handleLockSeats}
                                disabled={selectedSeats.length === 0}
                            >
                                Continue to Checkout
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default SeatSelection;
