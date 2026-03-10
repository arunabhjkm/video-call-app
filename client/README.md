# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## API Endpoint Configuration

This project uses an environment variable to determine the backend/socket server URL. Vite exposes only variables prefixed with `VITE_` to the client bundle.

- Create a `.env` (and mode‑specific files like `.env.development` or `.env.production`) in the `client/` directory.
- Set `VITE_API_URL` to the appropriate address, e.g.:

```dotenv
# development (default)
VITE_API_URL=http://localhost:5000

# production (.env.production)
VITE_API_URL=https://videocall.insaaf99.com
```

In your React components you can then refer to it via `import.meta.env.VITE_API_URL`.

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
