import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import './Header.css';

function Header() {
    const { user, logout } = useAuth();

    return (
        <header className="header">
            <div className="container">
                <div className="header-content">
                    <Link to="/" className="logo">
                        <span className="gradient-text">TicketHub</span>
                    </Link>

                    <nav className="nav">
                        <Link to="/" className="nav-link">Events</Link>
                        {user ? (
                            <>
                                <Link to="/my-bookings" className="nav-link">My Tickets</Link>
                                <button onClick={logout} className="btn btn-ghost">Logout</button>
                            </>
                        ) : (
                            <Link to="/login" className="btn btn-primary">Sign In</Link>
                        )}
                    </nav>
                </div>
            </div>
        </header>
    );
}

export default Header;
