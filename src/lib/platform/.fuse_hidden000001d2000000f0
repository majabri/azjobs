// src/lib/validation.ts

// Utility to validate an email address
export const isValidEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
};

// Utility to validate a URL
export const isValidURL = (url: string): boolean => {
    const urlRegex = /^(https?|chrome):\/\/[^\s$.?#].[^\s]*$/gm;
    return urlRegex.test(url);
};

// Utility to validate a phone number
export const isValidPhone = (phone: string): boolean => {
    const phoneRegex = /^\+?[1-9]\d{1,14}$/;
    return phoneRegex.test(phone);
};

// Utility to validate a form with multiple fields
export const validateForm = (fields: Record<string, any>): boolean => {
    return Object.keys(fields).every(key => {
        switch (key) {
            case 'email':
                return isValidEmail(fields[key]);
            case 'url':
                return isValidURL(fields[key]);
            case 'phone':
                return isValidPhone(fields[key]);
            default:
                return true; // Assuming other fields are valid for this example
        }
    });
};
