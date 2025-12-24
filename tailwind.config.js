/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            fontSize: {
                'xs': ['0.625rem', { lineHeight: '0.75rem' }],      // 10px (was 12px)
                'sm': ['0.75rem', { lineHeight: '0.875rem' }],     // 12px (was 14px)
                'base': ['0.875rem', { lineHeight: '1.25rem' }],   // 14px (was 16px)
                'lg': ['1rem', { lineHeight: '1.5rem' }],          // 16px (was 18px)
                'xl': ['1.125rem', { lineHeight: '1.75rem' }],     // 18px (was 20px)
                '2xl': ['1.375rem', { lineHeight: '1.875rem' }],   // 22px (was 24px)
                '3xl': ['1.625rem', { lineHeight: '2rem' }],       // 26px (was 30px)
                '4xl': ['2rem', { lineHeight: '2.25rem' }],        // 32px (was 36px)
                '5xl': ['2.5rem', { lineHeight: '1' }],             // 40px (was 48px)
                '6xl': ['3rem', { lineHeight: '1' }],               // 48px (was 60px)
            },
        },
    },
    plugins: [],
}
