import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { authApi, usersApi, setToken, clearToken, getToken } from '../lib/api';

export interface User {
  id: string;
  username: string;
  name: string;
  role: 'admin' | 'staff';
  createdAt: Date;
}

interface AuthState {
  currentUser: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isOffline: boolean;
  users: User[];

  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  initialize: () => Promise<void>;

  loadUsers: () => Promise<void>;
  addUser: (user: { username: string; password: string; name: string; role: 'admin' | 'staff' }) => Promise<{ success: boolean; error?: string }>;
  updateUser: (id: string, updates: Partial<{ username: string; name: string; role: 'admin' | 'staff' }>) => Promise<boolean>;
  deleteUser: (id: string) => Promise<boolean>;

  factoryResetUsers: () => Promise<void>;
  setOffline: (offline: boolean) => void;
}

export const useAuth = create<AuthState>()(
  persist(
    (set, get) => ({
      currentUser: null,
      isAuthenticated: false,
      isLoading: true,
      isOffline: !navigator.onLine,
      users: [],

      setOffline: (offline) => set({ isOffline: offline }),

      initialize: async () => {
        const isOffline = !navigator.onLine;
        set({ isOffline });

        // If we have a cached user, use it immediately (offline support)
        const { currentUser } = get();
        if (currentUser) {
          console.log('[Auth] Using cached user:', currentUser.username);
          set({ isAuthenticated: true, isLoading: false });

          // If online and we have a token, verify in background
          if (!isOffline && getToken()) {
            authApi.me().then((user) => {
              set({
                currentUser: {
                  id: user.id,
                  username: user.username,
                  name: user.name,
                  role: user.role as 'admin' | 'staff',
                  createdAt: new Date(),
                },
                isAuthenticated: true,
              });
            }).catch(() => {
              // Token expired or invalid - clear auth
              console.log('[Auth] Token invalid, clearing session');
              clearToken();
              set({ currentUser: null, isAuthenticated: false });
            });
          }
          return;
        }

        // No cached user - check if we have a valid token
        if (!isOffline && getToken()) {
          try {
            const user = await authApi.me();
            set({
              currentUser: {
                id: user.id,
                username: user.username,
                name: user.name,
                role: user.role as 'admin' | 'staff',
                createdAt: new Date(),
              },
              isAuthenticated: true,
            });
          } catch {
            clearToken();
          }
        }

        set({ isLoading: false });

        // Listen for online/offline events
        window.addEventListener('online', () => {
          console.log('[Auth] Back online');
          set({ isOffline: false });
        });
        window.addEventListener('offline', () => {
          console.log('[Auth] Gone offline');
          set({ isOffline: true });
        });
      },

      login: async (username, password) => {
        const { isOffline, currentUser } = get();

        // Offline login with cached user
        if (isOffline) {
          if (currentUser?.username === username) {
            set({ isAuthenticated: true });
            return { success: true };
          }
          return { success: false, error: 'No internet connection. Please connect to log in for the first time.' };
        }

        try {
          const response = await authApi.login(username, password);
          setToken(response.token);

          const user: User = {
            id: response.user.id,
            username: response.user.username,
            name: response.user.name,
            role: response.user.role as 'admin' | 'staff',
            createdAt: new Date(),
          };

          set({ currentUser: user, isAuthenticated: true });
          return { success: true };
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Login failed';
          return { success: false, error: message };
        }
      },

      logout: async () => {
        clearToken();
        set({ currentUser: null, isAuthenticated: false });
      },

      loadUsers: async () => {
        if (!navigator.onLine || !getToken()) return;

        try {
          const apiUsers = await usersApi.list();
          const users: User[] = apiUsers.map(u => ({
            id: u.id,
            username: u.username,
            name: u.name,
            role: u.role as 'admin' | 'staff',
            createdAt: new Date(),
          }));
          set({ users });
        } catch (error) {
          console.error('Error loading users:', error);
        }
      },

      addUser: async ({ username, password, name, role }) => {
        if (!navigator.onLine) {
          return { success: false, error: 'Cannot add users while offline' };
        }

        try {
          await usersApi.create({
            username,
            display_name: name,
            password,
            role,
          });
          await get().loadUsers();
          return { success: true };
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Failed to create user';
          return { success: false, error: message };
        }
      },

      updateUser: async (id, updates) => {
        if (!navigator.onLine) return false;

        try {
          await usersApi.update(id, {
            username: updates.username,
            display_name: updates.name,
            role: updates.role,
          });

          const { users, currentUser } = get();
          const updatedUsers = users.map(u =>
            u.id === id ? { ...u, ...updates, name: updates.name || u.name } : u
          );

          const updatedCurrentUser = currentUser?.id === id
            ? { ...currentUser, ...updates, name: updates.name || currentUser.name }
            : currentUser;

          set({ users: updatedUsers, currentUser: updatedCurrentUser });
          return true;
        } catch (error) {
          console.error('Error updating user:', error);
          return false;
        }
      },

      deleteUser: async (id) => {
        if (!navigator.onLine) return false;

        const { users, currentUser } = get();
        if (currentUser?.id === id) return false;

        try {
          await usersApi.delete(id);
          set({ users: users.filter(u => u.id !== id) });
          return true;
        } catch (error) {
          console.error('Error deleting user:', error);
          return false;
        }
      },

      factoryResetUsers: async () => {
        await get().logout();
      },
    }),
    {
      name: 'cbd-intake-auth',
      partialize: (state) => ({
        currentUser: state.currentUser,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
