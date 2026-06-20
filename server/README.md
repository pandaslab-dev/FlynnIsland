# Flynn Island Multiplayer Server

## Run Locally

Preferred repo-root flow:

```bash
npm install
npm run dev
```

Alternative server-only flow:

1. Open a terminal in this folder:
   - `cd server`
2. Install dependencies:
   - `npm install`
3. Start the server:
   - `npm run dev`

The server runs on port `3000` by default:
- `http://localhost:3000`

Optional:
- Set a custom port with `PORT`, for example:
  - `PORT=4000 node server.js`

Live deployment:

- `https://flynnisland.pandaslab.dev`
- The site is hosted on a free Render instance, so cold starts can sometimes add around 15 seconds to the first load.
