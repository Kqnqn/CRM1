'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { translations, Language } from './translations';

interface LanguageContextType {
    language: Language;
    setLanguage: (lang: Language) => void;
    t: (key: string, params?: Record<string, string>) => string;
    formatCurrency: (amount: number) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
    const [language, setLanguage] = useState<Language>('bs');

    // Load saved language from local storage on mount
    useEffect(() => {
        const saved = localStorage.getItem('language') as Language;
        if (saved && (saved === 'bs' || saved === 'en')) {
            setLanguage(saved);
        }
    }, []);

    // Save language to local storage when changed
    useEffect(() => {
        localStorage.setItem('language', language);
    }, [language]);

    const t = (key: string, params?: Record<string, string>) => {
        let text = translations[language][key as keyof typeof translations['bs']] || key;

        if (params) {
            Object.entries(params).forEach(([param, value]) => {
                text = text.replace(`{${param}}`, value);
            });
        }

        return text;
    };

    const formatCurrency = (amount: number) => {
        // Always use BAM (KM) as the currency code, but format number based on locale preference
        // actually requirement says BAM default.
        // In Bosnia, format is usually 1.234,56 KM or KM 1.234,56

        if (language === 'bs') {
            return new Intl.NumberFormat('bs-BA', {
                style: 'currency',
                currency: 'BAM',
                currencyDisplay: 'symbol', // "KM"
            }).format(amount);
        } else {
            // For English, we can still show BAM but maybe with english number formatting?
            // Or just stick to bs-BA formatting for consistency since currency is BAM.
            // Let's use English formatting but with BAM currency.
            return new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: 'BAM',
                currencyDisplay: 'code', // "BAM 1,234.56"
            }).format(amount);
        }
    };

    return (
        <LanguageContext.Provider value={{ language, setLanguage, t, formatCurrency }}>
            {children}
        </LanguageContext.Provider>
    );
}

export function useLanguage() {
    const context = useContext(LanguageContext);
    if (context === undefined) {
        throw new Error('useLanguage must be used within a LanguageProvider');
    }
    return context;
}
