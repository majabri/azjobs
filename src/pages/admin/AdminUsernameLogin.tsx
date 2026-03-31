import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

const AdminUsernameLogin = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showUsername, setShowUsername] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    const handleSubmit = async (event) => {
        event.preventDefault();
        const { data, error } = await supabase.auth.signInWithPassword({
            email: username,
            password,
        });
        if (error) console.error('Login failed:', error);
        else console.log('Login successful:', data);
    };

    return (
        <div>
            <h1>Admin Login</h1>
            <form onSubmit={handleSubmit}>
                <div>
                    <label htmlFor="username">Username</label>
                    <div>
                        <input
                            type={showUsername ? 'text' : 'password'}
                            id="username"
                            placeholder=""
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                        />
                        <button type="button" onClick={() => setShowUsername((prev) => !prev)}>
                            {showUsername ? 'Hide' : 'Show'}
                        </button>
                    </div>
                </div>
                <div>
                    <label htmlFor="password">Password</label>
                    <div>
                        <input
                            type={showPassword ? 'text' : 'password'}
                            id="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                        />
                        <button type="button" onClick={() => setShowPassword((prev) => !prev)}>
                            {showPassword ? 'Hide' : 'Show'}
                        </button>
                    </div>
                </div>
                <button type="submit">Login</button>
            </form>
        </div>
    );
};

export default AdminUsernameLogin;