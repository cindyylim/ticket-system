import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { apiService } from '../services/api.service';
import './Home.css';

interface Event {
    _id: string;
    title: string;
    date: string;
    imageUrl: string;
    category: string;
    performerId: { name: string; genre: string };
    venueId: { name: string; city: string; state: string };
    priceTiers: { section: string; price: number }[];
}

function Home() {
    const [events, setEvents] = useState<Event[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [category, setCategory] = useState('');

    useEffect(() => {
        loadEvents();
    }, [category]);

    const loadEvents = async () => {
        try {
            setLoading(true);
            const data = await apiService.getEvents({ page: 1, category, search });
            setEvents(data.events);
        } catch (error) {
            console.error('Failed to load events:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        loadEvents();
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            year: 'numeric',
        });
    };

    return (
        <div className="home">
            {/* Hero Section */}
            <section className="hero">
                <div className="container">
                    <h1 className="hero-title fade-in">
                        Live Events. <span className="gradient-text">Unforgettable Moments.</span>
                    </h1>
                    <p className="hero-subtitle">
                        Discover and book tickets to the hottest concerts, sports, and entertainment events
                    </p>

                    <form onSubmit={handleSearch} className="search-form">
                        <input
                            type="text"
                            placeholder="Search for artists, events, or venues..."
                            className="input search-input"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                        <button type="submit" className="btn btn-primary">Search</button>
                    </form>
                </div>
            </section>

            {/* Categories */}
            <section className="categories">
                <div className="container">
                    <div className="category-buttons">
                        <button
                            className={`btn ${!category ? 'btn-primary' : 'btn-ghost'}`}
                            onClick={() => setCategory('')}
                        >
                            All Events
                        </button>
                        <button
                            className={`btn ${category === 'Concert' ? 'btn-primary' : 'btn-ghost'}`}
                            onClick={() => setCategory('Concert')}
                        >
                            Concerts
                        </button>
                        <button
                            className={`btn ${category === 'Sports' ? 'btn-primary' : 'btn-ghost'}`}
                            onClick={() => setCategory('Sports')}
                        >
                            Sports
                        </button>
                    </div>
                </div>
            </section>

            {/* Events Grid */}
            <section className="events-section">
                <div className="container">
                    <h2 className="section-title">Upcoming Events</h2>

                    {loading ? (
                        <div className="loading-container">
                            <div className="spinner"></div>
                        </div>
                    ) : (
                        <div className="events-grid">
                            {events.map((event) => (
                                <Link
                                    to={`/events/${event._id}`}
                                    key={event._id}
                                    className="event-card card"
                                >
                                    <div className="event-image">
                                        <img src={event.imageUrl} alt={event.title} />
                                        <span className="event-category badge">{event.category}</span>
                                    </div>
                                    <div className="event-content">
                                        <h3 className="event-title">{event.title}</h3>
                                        <p className="event-performer">{event.performerId.name}</p>
                                        <div className="event-details">
                                            <div className="event-date">
                                                <svg
                                                    width="16"
                                                    height="16"
                                                    viewBox="0 0 16 16"
                                                    fill="currentColor"
                                                >
                                                    <path d="M11 2V1H10V2H6V1H5V2H2V15H14V2H11ZM3 3H5V4H6V3H10V4H11V3H13V5H3V3ZM3 14V6H13V14H3Z" />
                                                </svg>
                                                {formatDate(event.date)}
                                            </div>
                                            <div className="event-venue">
                                                <svg
                                                    width="16"
                                                    height="16"
                                                    viewBox="0 0 16 16"
                                                    fill="currentColor"
                                                >
                                                    <path d="M8 1C5.24 1 3 3.24 3 6C3 9.5 8 15 8 15C8 15 13 9.5 13 6C13 3.24 10.76 1 8 1ZM8 8C6.9 8 6 7.1 6 6C6 4.9 6.9 4 8 4C9.1 4 10 4.9 10 6C10 7.1 9.1 8 8 8Z" />
                                                </svg>
                                                {event.venueId.city}, {event.venueId.state}
                                            </div>
                                        </div>
                                        <div className="event-price">
                                            From ${Math.min(...event.priceTiers.map(t => t.price))}
                                        </div>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    )}
                </div>
            </section>
        </div>
    );
}

export default Home;
