import { writable, derived } from 'svelte/store';
import { browser } from '$app/environment';
import { authState } from './auth';

export interface UserInfo {
  name: string;
  email: string;
  avatar?: string;
  did?: string;
}

function createUserStore() {
  // Check for Storacha email immediately
  const storachaEmail = browser ? localStorage.getItem('storacha-email-login') : null;
  
  const defaultUser: UserInfo = {
    name: storachaEmail ? 'Storacha User' : 'User',
    email: storachaEmail || 'user@example.com',
  };

  // Load from localStorage if available
  const stored = browser ? localStorage.getItem('user-info') : null;
  const initial = stored ? JSON.parse(stored) : defaultUser;
  
  // If we have Storacha email but user-info doesn't, update it
  if (storachaEmail && initial.email === 'user@example.com') {
    initial.email = storachaEmail;
    if (browser) {
      localStorage.setItem('user-info', JSON.stringify(initial));
    }
  }

  const { subscribe, set, update } = writable<UserInfo>(initial);

  // Subscribe to auth state changes to update user info
  if (browser) {
    authState.subscribe($auth => {
      if ($auth.isAuthenticated && $auth.did) {
        update(current => {
          // Only update if we don't have custom user info
          const hasCustomInfo = current.email !== 'user@example.com';
          
          if (!hasCustomInfo) {
            const updated = {
              ...current,
              did: $auth.did || undefined,
              name: current.name === 'User' ? 'Authenticated User' : current.name,
            };
            
            // Try to get email from auth service
            import('../services/auth.js').then(({ authService }) => {
              const email = authService.getStoredEmail();
              if (email) {
                const withEmail = { ...updated, email };
                localStorage.setItem('user-info', JSON.stringify(withEmail));
                set(withEmail);
              } else {
                localStorage.setItem('user-info', JSON.stringify(updated));
                set(updated);
              }
            });
            
            return updated;
          }
          return current;
        });
      }
    });
  }

  return {
    subscribe,
    setUser: (user: UserInfo) => {
      if (browser) {
        localStorage.setItem('user-info', JSON.stringify(user));
      }
      set(user);
    },
    updateUser: (updates: Partial<UserInfo>) => {
      update(current => {
        const updated = { ...current, ...updates };
        if (browser) {
          localStorage.setItem('user-info', JSON.stringify(updated));
        }
        return updated;
      });
    },
  };
}

export const userStore = createUserStore();

// Derived store to show DID in a user-friendly format
export const userDID = derived(userStore, $user => 
  $user.did ? `${$user.did.slice(0, 20)}...${$user.did.slice(-10)}` : null
);
