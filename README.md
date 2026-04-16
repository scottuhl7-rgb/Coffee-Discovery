# Coffee Discovery

AI-powered single-origin coffee discovery with an interactive globe. Describe what you're in the mood for and get matched to coffees from 68 origins worldwide, with terroir profiles and nearby shop recommendations.

## Quick Start (Local)

```bash
# 1. Install dependencies
npm install

# 2. Copy env file and add your API keys
cp .env.example .env.local
# Edit .env.local with your keys (see below)

# 3. Run dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## API Keys

You need two API keys:

### Anthropic (required — powers AI recommendations)
1. Go to [console.anthropic.com](https://console.anthropic.com/)
2. Create an API key
3. Add to `.env.local` as `ANTHROPIC_API_KEY`

### Google Places (optional — powers "Find near me")
1. Go to [console.cloud.google.com](https://console.cloud.google.com/)
2. Enable the **Places API**
3. Create an API key
4. Add to `.env.local` as `GOOGLE_PLACES_API_KEY`
5. Free tier: $200/month credit (~5,000 searches)

The app works without Google Places — the "Find near me" button just won't return results.

## Deploy to Vercel (Free)

```bash
# 1. Push to GitHub
git init
git add .
git commit -m "initial commit"
gh repo create coffee-discovery --public --push

# 2. Deploy
npx vercel

# 3. Add environment variables in Vercel dashboard
#    Settings → Environment Variables → Add both API keys
```

Or connect your GitHub repo at [vercel.com/new](https://vercel.com/new) for automatic deploys.

## What's in the box

- **68 single-origin coffees** covering Ethiopia, Kenya, Rwanda, Burundi, Tanzania, DRC, Uganda, Colombia, Guatemala, Costa Rica, Panama, Honduras, El Salvador, Nicaragua, Mexico, Jamaica, Brazil, Peru, Ecuador, Bolivia, Yemen, Indonesia, Thailand, India, Papua New Guinea, Myanmar, Philippines, Vietnam, Hawaii, and the Galápagos
- **AI-powered preference matching** — describe what you want in natural language
- **Interactive D3 globe** with realistic coloring and smooth zoom animation
- **Terroir profiles** — altitude, variety, processing, harvest, tasting notes, flavor bars, and origin stories
- **Nearby shop search** — Google Places integration with ratings, open/closed status, and price level
- **Server-side API routes** — your API keys never hit the browser

## Project Structure

```
coffee-app/
├── app/
│   ├── layout.js          # Root layout
│   ├── page.js            # Main page
│   ├── globals.css         # Base styles
│   └── api/
│       ├── recommend/
│       │   └── route.js    # Anthropic proxy
│       └── places/
│           └── route.js    # Google Places proxy
├── components/
│   └── CoffeeDiscovery.jsx # Main interactive component
├── data/
│   └── coffees.js          # 68-origin database
└── package.json
```

## Extending

**Add more coffees:** Edit `data/coffees.js`. Each entry needs coordinates, flavor profile, terroir description, and a background gradient. The AI matching automatically picks up new entries.

**Improve "Find near me":** The current search uses a generic specialty coffee query. A better version would match specific roasters known to carry each origin — that's the inventory layer (V2).

**Add user accounts:** Track which coffees users have tried, build a personal flavor profile, unlock the "coffee passport" feature.
