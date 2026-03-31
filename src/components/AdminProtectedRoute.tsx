import React from 'react';
import { useAuth } from 'your_auth_hook';
import { Card, Button } from 'your_component_library';

const AdminProtectedRoute = ({ children }) => {
    const { isLoading, user, error } = useAuth();

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-screen">
                <Card className="p-4">
                    <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-gray-900"></div>
                    <p>Loading...</p>
                </Card>
            </div>
        );
    }

    if (error || !user || !user.isAdmin) {
        return (
            <div className="flex flex-col items-center justify-center h-screen">
                <Card className="p-4">
                    <h2 className="text-xl">Unauthorized Access</h2>
                    <p>You do not have permission to access this page.</p>
                    <div className="flex space-x-4 mt-4">
                        <Button link="/admin/login" className="bg-blue-500 hover:bg-blue-700">Go to Login</Button>
                        <Button link="/dashboard" className="bg-gray-500 hover:bg-gray-700">Go to Dashboard</Button>
                    </div>
                </Card>
            </div>
        );
    }

    return children;
};

export default AdminProtectedRoute;