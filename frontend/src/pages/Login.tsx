import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiService } from '../services/api.service';
import { useAuth } from '../hooks/useAuth';
import './Login.css';

function Login() {
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [error, setError] = useState('');
    const { login } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        try {
            if (isLogin) {
                const data = await apiService.login(email, password);
                login(data);
                navigate('/');
            } else {
                const data = await apiService.register(email, password, name);
                login(data);
                navigate('/');
            }
        } catch (err: any) {
            setError(err.response?.data?.error || 'Authentication failed');
        }
    };

    return (
        <div className="login-page">
            <div className="login-container">
                <div className="card login-card">
                    <h1 className="gradient-text">{isLogin ? 'Welcome Back' : 'Join TicketHub'}</h1>
                    <p className="login-subtitle">
                        {isLogin ? 'Sign in to your account' : 'Create your account'}
                    </p>

                    {error && <div className="error-message">{error}</div>}

                    <form onSubmit={handleSubmit} className="login-form">
                        {!isLogin && (
                            <div className="form-group">
                                <label>Name</label>
                                <input
                                    type="text"
                                    className="input"
                                    placeholder="Your name"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    required
                                />
                            </div>
                        )}

                        <div className="form-group">
                            <label>Email</label>
                            <input
                                type="email"
                                className="input"
                                placeholder="your@email.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label>Password</label>
                            <input
                                type="password"
                                className="input"
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                            />
                        </div>

                        <button type="submit" className="btn btn-primary btn-block">
                            {isLogin ? 'Sign In' : 'Create Account'}
                        </button>
                    </form>

                    <p className="login-toggle">
                        {isLogin ? "Don't have an account? " : 'Already have an account? '}
                        <button className="link-button" onClick={() => setIsLogin(!isLogin)}>
                            {isLogin ? 'Sign up' : 'Sign in'}
                        </button>
                    </p>

                    {isLogin && (
                        <div className="demo-credentials">
                            <p><strong>Demo Account:</strong></p>
                            <p>Email: test@example.com</p>
                            <p>Password: password123</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default Login;
