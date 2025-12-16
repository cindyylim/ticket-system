import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiService } from '../services/api.service';
import './EventDetails.css';

function EventDetails() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [event, setEvent] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (id) loadEvent();
    }, [id]);

    const loadEvent = async () => {
        try {
            const data = await apiService.getEvent(id!);
            setEvent(data);
        } catch (error) {
            console.error('Failed to load event:', error);
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

    if (!event) {
        return <div className="container">Event not found</div>;
    }

    return (
        <div className="event-details">
            <div className="event-hero" style={{ backgroundImage: `url(${event.imageUrl})` }}>
                <div className="event-hero-overlay">
                    <div className="container">
                        <div className="event-hero-content">
                            <span className="badge">{event.category}</span>
                            <h1 className="event-hero-title">{event.title}</h1>
                            <p className="event-hero-performer">{event.performerId.name}</p>
                            <div className="event-hero-info">
                                <div>{new Date(event.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</div>
                                <div>{event.venueId.name} • {event.venueId.city}, {event.venueId.state}</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="container event-body">
                <div className="event-main">
                    <h2>About This Event</h2>
                    <p>{event.description || 'An unforgettable live experience awaits!'}</p>

                    <h3>Pricing</h3>
                    <div className="price-tiers">
                        {event.priceTiers.map((tier: any, index: number) => (
                            <div key={index} className="price-tier card">
                                <div className="price-tier-section">{tier.section}</div>
                                <div className="price-tier-price">${tier.price}</div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="event-sidebar">
                    <div className="card booking-card">
                        <h3>Get Tickets</h3>
                        <button
                            className="btn btn-primary btn-block"
                            onClick={() => navigate(`/events/${id}/seats`)}
                        >
                            Select Seats
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default EventDetails;
