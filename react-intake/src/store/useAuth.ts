import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { User as SupabaseUser } from '@supabase/supabase-js';

export interface User {
  id: string;
  username: string;
  name: string;
  email?: string;
  role: 'admin' | 'staff';
  createdAt: Date;
}

interface AuthState {
  // Current session
  currentUser: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isOffline: boolean;
  
  // User management
  users: User[];
  
  // Actions
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  
  // Initialize - check for existing session
  initialize: () => Promise<void>;
  
  // User CRUD (admin only)
  loadUsers: () => Promise<void>;
  addUser: (user: { username: string; email: string; password: string; name: string; role: 'admin' | 'staff' }) => Promise<{ success: boolean; error?: string }>;
  updateUser: (id: string, updates: Partial<{ username: string; name: string; role: 'admin' | 'staff' }>) => Promise<boolean>;
  deleteUser: (id: string) => Promise<boolean>;
  
  // Factory reset
  factoryResetUsers: () => Promise<void>;
  
  // Offline support
  setOffline: (offline: boolean) => void;
}

// Map Supabase user to our User type
async function mapSupabaseUser(supabaseUser: SupabaseUser): Promise<User | null> {
  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', supabaseUser.id)
      .single();

    if (!profile) return null;

    return {
      id: supabaseUser.id,
      username: profile.username,
      name: profile.display_name,
      email: supabaseUser.email,
      role: profile.role as 'admin' | 'staff',
      createdAt: new Date(profile.created_at),
    };
  } catch (error) {
    console.error('Error mapping user:', error);
    return null;
  }
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
        // Check online status
        const isOffline = !navigator.onLine;
        set({ isOffline });

        // If we have a cached user and are offline, use it
        const { currentUser } = get();
        if (currentUser && isOffline) {
          set({ isAuthenticated: true, isLoading: false });
          return;
        }

        if (!isSupabaseConfigured()) {
          set({ isLoading: false });
          return;
        }

        try {
          const { data: { session } } = await supabase.auth.getSession();
          
          if (session?.user) {
            const user = await mapSupabaseUser(session.user);
            if (user) {
              set({ currentUser: user, isAuthenticated: true });
            }
          }
        } catch (error) {
          console.error('Auth initialization error:', error);
          // If offline and we have a cached user, still allow access
          if (isOffline && currentUser) {
            set({ isAuthenticated: true });
          }
        } finally {
          set({ isLoading: false });
        }

        // Listen for auth changes
        supabase.auth.onAuthStateChange(async (event, session) => {
          if (event === 'SIGNED_IN' && session?.user) {
            const user = await mapSupabaseUser(session.user);
            if (user) {
              set({ currentUser: user, isAuthenticated: true });
            }
          } else if (event === 'SIGNED_OUT') {
            set({ currentUser: null, isAuthenticated: false });
          }
        });

        // Listen for online/offline events
        window.addEventListener('online', () => set({ isOffline: false }));
        window.addEventListener('offline', () => set({ isOffline: true }));
      },

      login: async (email, password) => {
        const { isOffline, currentUser } = get();

        // If offline and we have a cached user with matching email, allow login
        if (isOffline) {
          if (currentUser?.email === email) {
            set({ isAuthenticated: true });
            return { success: true };
          }
          return { success: false, error: 'No internet connection. Please connect to log in for the first time.' };
        }

        if (!isSupabaseConfigured()) {
          return { success: false, error: 'Authentication service not configured' };
        }

        try {
          const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
          });

          if (error) {
            return { success: false, error: error.message };
          }

          if (data.user) {
            const user = await mapSupabaseUser(data.user);
            if (user) {
              set({ currentUser: user, isAuthenticated: true });
              return { success: true };
            }
          }

          return { success: false, error: 'Failed to load user profile' };
        } catch (error) {
          return { success: false, error: 'Login failed. Please check your connection.' };
        }
      },

      logout: async () => {
        if (isSupabaseConfigured() && navigator.onLine) {
          await supabase.auth.signOut();
        }
        set({ currentUser: null, isAuthenticated: false });
      },

      loadUsers: async () => {
        if (!isSupabaseConfigured() || !navigator.onLine) return;

        try {
          const { data: profiles, error } = await supabase
            .from('profiles')
            .select('*')
            .order('created_at');

          if (error) {
            console.error('Error loading users:', error);
            return;
          }

          const users: User[] = profiles.map(profile => ({
            id: profile.id,
            username: profile.username,
            name: profile.display_name,
            role: profile.role as 'admin' | 'staff',
            createdAt: new Date(profile.created_at),
          }));

          set({ users });
        } catch (error) {
          console.error('Error loading users:', error);
        }
      },

      addUser: async ({ username, email, password, name, role }) => {
        if (!isSupabaseConfigured() || !navigator.onLine) {
          return { success: false, error: 'Cannot add users while offline' };
        }

        try {
          const { error } = await supabase.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: {
              username,
              display_name: name,
              role,
            },
          });

          if (error) {
            // Fallback: try regular signup
            const { error: signUpError } = await supabase.auth.signUp({
              email,
              password,
              options: {
                data: {
                  username,
                  display_name: name,
                  role,
                },
              },
            });

            if (signUpError) {
              return { success: false, error: signUpError.message };
            }
          }

          await get().loadUsers();
          return { success: true };
        } catch (error) {
          return { success: false, error: 'Failed to create user' };
        }
      },

      updateUser: async (id, updates) => {
        if (!isSupabaseConfigured() || !navigator.onLine) return false;

        try {
          const updateData: Record<string, string> = {};
          if (updates.username) updateData.username = updates.username;
          if (updates.name) updateData.display_name = updates.name;
          if (updates.role) updateData.role = updates.role;

          const { error } = await supabase
            .from('profiles')
            .update(updateData)
            .eq('id', id);

          if (error) {
            console.error('Error updating user:', error);
            return false;
          }

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
        if (!isSupabaseConfigured() || !navigator.onLine) return false;

        const { users, currentUser } = get();

        const user = users.find(u => u.id === id);
        if (user?.role === 'admin') {
          const adminCount = users.filter(u => u.role === 'admin').length;
          if (adminCount <= 1) return false;
        }

        if (currentUser?.id === id) return false;

        try {
          const { error } = await supabase.auth.admin.deleteUser(id);

          if (error) {
            await supabase.from('profiles').delete().eq('id', id);
          }

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
