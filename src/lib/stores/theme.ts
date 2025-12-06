import { writable, get } from 'svelte/store';
import { browser } from '$app/environment';

type Theme = 'light' | 'dark';

function createThemeStore() {
	const stored = browser ? localStorage.getItem('theme') : null;
	const initial: Theme = (stored as Theme) || 'light';
	
	const { subscribe, set, update } = writable<Theme>(initial);
	
	// Apply theme on initialization
	if (browser && initial) {
		document.documentElement.setAttribute('data-theme', initial);
	}
	
	return {
		subscribe,
		toggle: () => {
			update(current => {
				const newTheme = current === 'light' ? 'dark' : 'light';
				if (browser) {
					localStorage.setItem('theme', newTheme);
					document.documentElement.setAttribute('data-theme', newTheme);
				}
				return newTheme;
			});
		},
		set: (theme: Theme) => {
			if (browser) {
				localStorage.setItem('theme', theme);
				document.documentElement.setAttribute('data-theme', theme);
			}
			set(theme);
		}
	};
}

export const themeStore = createThemeStore();
