/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          blue: '#4f8ef7',
          green: '#3ecf8e',
        },
        cream: {
          DEFAULT: '#F7F1E3',
          soft: '#FBF7EE',
          deep: '#EFE6D2',
        },
        ink: {
          DEFAULT: '#15130F',
          soft: '#26241E',
          muted: '#6B6659',
        },
        butter: {
          DEFAULT: '#F3DE94',
          soft: '#F7E7AF',
          deep: '#E8C763',
        },
        blush: {
          DEFAULT: '#F4C6D7',
          soft: '#F8D9E4',
          deep: '#EDA3BE',
        },
        sage: {
          DEFAULT: '#BFCE9C',
          soft: '#D3DEBA',
          deep: '#9FB273',
        },
        sky: {
          DEFAULT: '#BBD6E8',
          soft: '#D3E5F0',
          deep: '#8FB9D6',
        },
      },
      borderRadius: {
        '2xl': '1.1rem',
        '3xl': '1.5rem',
        '4xl': '2rem',
        '5xl': '2.5rem',
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        pop: '0 2px 0 0 rgba(21,19,15,1)',
        popLg: '0 4px 0 0 rgba(21,19,15,1)',
      },
    },
  },
  plugins: [],
}