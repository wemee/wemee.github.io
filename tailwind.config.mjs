/** @type {import('tailwindcss').Config} */
export default {
	content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
	theme: {
		extend: {
			colors: {
				sudoku: {
					bg: '#073642',
					'cell-bg': '#002b36',
					'cell-bg-fixed': '#073642',
					'cell-bg-selected': '#268bd2',
					'cell-bg-related': 'rgba(38, 139, 210, 0.15)',
					'cell-bg-error': 'rgba(220, 50, 47, 0.3)',
					text: '#93a1a1',
					'text-fixed': '#fdf6e3',
					'text-user': '#2aa198',
					'text-selected': '#fdf6e3',
					border: '#586e75',
					'border-block': '#93a1a1',
					'button-bg': '#073642',
					'button-hover': '#586e75',
				}
			},
			fontFamily: {
				sans: ['Inter', 'sans-serif'],
			}
		},
	},
	plugins: [],
	corePlugins: {
		preflight: false,
	}
}
