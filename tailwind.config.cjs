/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      typography: {
        DEFAULT: {
          css: {
            maxWidth: '100%',
            color: '#1A1A1A',
            lineHeight: '1.8',
            fontSize: '1.25rem',
            p: {
              marginBottom: '1.5em',
            },
            'h1, h2, h3, h4': {
              color: '#000',
              fontWeight: '800',
              letterSpacing: '-0.02em',
              marginTop: '2em',
              marginBottom: '0.8em',
              lineHeight: '1.2',
            },
            a: {
              color: '#2563eb',
              textDecoration: 'underline',
              textUnderlineOffset: '4px',
              fontWeight: '600',
              '&:hover': {
                color: '#1d4ed8',
              },
            },
            blockquote: {
              borderLeftWidth: '4px',
              borderLeftColor: '#000',
              fontStyle: 'italic',
              paddingLeft: '1.5rem',
              color: '#5F5F5F',
            },
            li: {
              marginTop: '0.5em',
              marginBottom: '0.5em',
            },
          },
        },
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
};
