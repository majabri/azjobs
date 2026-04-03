import React from 'react';
import { useNavigate } from 'react-router-dom';

const Index = () => {
    const navigate = useNavigate();

    const handleSignIn = () => {
        navigate('/auth/login'); // Changed to /auth/login
    };

    return (
        <div>
            <nav>
                <button onClick={handleSignIn}>Sign In</button>
            </nav>
            <div className="hero">
                <button onClick={() => navigate(user ? '/some-path' : '/auth/login')}>Call to Action</button> {/* Changed to /auth/login */}
            </div>
            <div className="cta-buttons">
                <button onClick={() => navigate('/auth/login')}>Find Jobs For Me</button> {/* Changed to /auth/login */}
                <button onClick={() => navigate('/auth/login')}>Upload Resume Now</button> {/* Changed to /auth/login */}
                <button onClick={() => navigate('/auth/login')}>Demo Result</button> {/* Changed to /auth/login */}
                <button onClick={() => navigate('/auth/login')}>Get Started</button> {/* Changed to /auth/login */}
                <button onClick={() => navigate('/auth/login')}>Optimize My Resume</button> {/* Changed to /auth/login */}
                <button onClick={() => navigate('/auth/login')}>Comparison Table</button> {/* Changed to /auth/login */}
                <button onClick={() => navigate(user ? f.link : '/auth/login')}>Build Your Profile</button> {/* Changed to /auth/login */}
                <button onClick={() => navigate('/auth/login')}>Get Started Free</button> {/* Changed to /auth/login */}
            </div>
            <div className="sticky-cta">
                <button onClick={() => navigate('/auth/login')}>Sticky CTA</button> {/* Changed to /auth/login */}
            </div>
        </div>
    );
};

export default Index;
