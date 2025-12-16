import { useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import Header from './components/Header';
import Home from './pages/Home';
import EventDetails from './pages/EventDetails';
import SeatSelection from './pages/SeatSelection';
import Checkout from './pages/Checkout';
import MyBookings from './pages/MyBookings';
import Login from './pages/Login';

function App() {
    const { user, initialize } = useAuth();

    useEffect(() => {
        initialize();
    }, [initialize]);

    return (
        <BrowserRouter>
            <div className="app">
                <Header />
                <Routes>
                    <Route path="/" element={<Home />} />
                    <Route path="/events/:id" element={<EventDetails />} />
                    <Route path="/events/:id/seats" element={<SeatSelection />} />
                    <Route path="/checkout" element={<Checkout />} />
                    <Route path="/my-bookings" element={user ? <MyBookings /> : <Login />} />
                    <Route path="/login" element={<Login />} />
                </Routes>
            </div>
        </BrowserRouter>
    );
}

export default App;
