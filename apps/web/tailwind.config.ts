import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', '"SF Pro Display"', '"Segoe UI"', 'system-ui', 'sans-serif'],
      },
      colors: {
        surface: {
          DEFAULT: '#ffffff',
          secondary: '#f5f5f7',
          tertiary: '#e8e8ed',
        },
        ink: {
          primary: '#1d1d1f',
          secondary: '#6e6e73',
          tertiary: '#aeaeb2',
        },
        accent: {
          DEFAULT: '#0071e3',
          hover: '#0077ed',
          light: '#e8f1fb',
        },
        success: '#30d158',
        warning: '#ff9f0a',
        error: '#ff453a',
      },
      borderRadius: {
        xl: '1rem',
        '2xl': '1.25rem',
        '3xl': '1.5rem',
      },
      boxShadow: {
        card: '0 2px 12px rgba(0,0,0,0.08)',
        'card-hover': '0 8px 28px rgba(0,0,0,0.12)',
        modal: '0 20px 60px rgba(0,0,0,0.16)',
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
};

export default config;
