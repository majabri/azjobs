import React, { useState } from 'react';
import { supabase } from '../../utils/supabaseClient';

const AdminLogin = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    const handleSubmit = async (event) => {
        event.preventDefault();
        const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });
        if (error) {
            alert('Login failed: ' + error.message);
        } else {
            alert('Login successful!');
        }
    };

    return (
        <form onSubmit={handleSubmit}>
            <h1>Sign In</h1>
            <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
            />
            <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
            />
            <button type="submit">Sign In</button>
        </form>
    );
};

export default AdminLogin;