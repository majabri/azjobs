import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

const AdminUsernameLogin = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');

    const handleLogin = async (e) => {
        e.preventDefault();
        const { data: profiles } = await supabase
            .from('profiles')
            .select('email')
            .ilike('username', username)
            .single();

        if (profiles) {
            const { error } = await supabase.auth.signInWithPassword({
                email: profiles.email,
                password
            });

            if (!error) {
                window.location.href = '/admin';
            } else {
                alert(error.message);
            }
        } else {
            alert('User not found');
        }
    };

    return (
        <form onSubmit={handleLogin}>
            <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Username"
                required
            />
            <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                required
            />
            <button type="submit">Login</button>
        </form>
    );
};

export default AdminUsernameLogin;