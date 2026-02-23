/**
 * DB コンテキスト — アプリ全体でDBインスタンスを共有
 */
import { CategoryRepository } from '@/lib/db/repositories/category-repository';
import { TransactionRepository } from '@/lib/db/repositories/transaction-repository';
import { initDatabase } from '@/lib/db/schema';
import * as SQLite from 'expo-sqlite';
import React, { createContext, ReactNode, useContext, useEffect, useState } from 'react';

interface DatabaseContextType {
    db: SQLite.SQLiteDatabase | null;
    transactionRepo: TransactionRepository | null;
    categoryRepo: CategoryRepository | null;
    isReady: boolean;
}

const DatabaseContext = createContext<DatabaseContextType>({
    db: null,
    transactionRepo: null,
    categoryRepo: null,
    isReady: false,
});

export function DatabaseProvider({ children }: { children: ReactNode }) {
    const [state, setState] = useState<DatabaseContextType>({
        db: null,
        transactionRepo: null,
        categoryRepo: null,
        isReady: false,
    });

    useEffect(() => {
        let mounted = true;

        (async () => {
            try {
                const db = await initDatabase();
                if (mounted) {
                    setState({
                        db,
                        transactionRepo: new TransactionRepository(db),
                        categoryRepo: new CategoryRepository(db),
                        isReady: true,
                    });
                }
            } catch (error) {
                console.error('Failed to initialize database:', error);
            }
        })();

        return () => {
            mounted = false;
        };
    }, []);

    return (
        <DatabaseContext.Provider value={state}>
            {children}
        </DatabaseContext.Provider>
    );
}

export function useDatabase() {
    const context = useContext(DatabaseContext);
    if (!context) {
        throw new Error('useDatabase must be used within a DatabaseProvider');
    }
    return context;
}
