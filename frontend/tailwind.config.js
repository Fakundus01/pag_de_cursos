/** @type {import("tailwindcss").Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        abyss: "#081a24",
        nebula: "#11384d",
        steel: "#7ea2b2",
        aurora: "#8cc6bb",
        sand: "#d9d1bb",
        flare: "#f2b26b"
      },
      boxShadow: {
        glow: "0 18px 45px rgba(10, 31, 43, 0.3)"
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-10px)" }
        },
        reveal: {
          "0%": { opacity: "0", transform: "translateY(16px)" },
          "100%": { opacity: "1", transform: "translateY(0)" }
        }
      },
      animation: {
        float: "float 6s ease-in-out infinite",
        reveal: "reveal 0.7s ease forwards"
      }
    }
  },
  plugins: []
};
