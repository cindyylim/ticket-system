import { useState, useEffect } from 'react';
import { apiService } from '../services/api.service';

function MyBookings() {
    const [bookings, setBookings] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadBookings();
    }, []);

    const loadBookings = async () => {
        try {
            const data = await apiService.getMyBookings();
            setBookings(data);
        } catch (error) {
            console.error('Failed to load bookings:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="loading-container">
                <div className="spinner"></div>
            </div>
        );
    }

    return (
        <div className="my-bookings" style={{ padding: '60px 0', minHeight: '100vh' }}>
            <div className="container">
                <h1>My Tickets</h1>

                {bookings.length === 0 ? (
                    <div className="card" style={{ textAlign: 'center', padding: '60px' }}>
                        <p style={{ color: 'var(--text-secondary)' }}>No bookings yet</p>
                    </div>
                ) : (
                    <div style={{ display: 'grid', gap: '24px', marginTop: '32px' }}>
                        {bookings.map((booking) => (
                            <div key={booking._id} className="card">
                                <h3>{booking.eventId?.title}</h3>
                                <p>{new Date(booking.eventId?.date).toLocaleDateString()}</p>
                                <div className="seats-list" style={{ margin: '16px 0' }}>
                                    <h4 style={{ fontSize: '14px', color: '#666', marginBottom: '8px' }}>Seats:</h4>
                                    <div style={{ display: 'grid', gap: '8px' }}>
                                        {booking.seatIds?.map((seat: any) => (
                                            <div key={seat._id} style={{
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                padding: '8px',
                                                backgroundColor: 'black',
                                                borderRadius: '4px',
                                                fontSize: '14px'
                                            }}>
                                                <span>{seat.section} • Row {seat.row} • Seat {seat.seatNumber}</span>
                                                <span>${seat.price}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div style={{
                                    borderTop: '1px solid #eee',
                                    marginTop: '16px',
                                    paddingTop: '16px',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    fontWeight: 'bold'
                                }}>
                                    <span>Total</span>
                                    <span>${booking.totalPrice}</span>
                                </div>
                                <span className={`badge badge-${booking.status}`}>{booking.status}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

export default MyBookings;
