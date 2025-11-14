# Jumperlink Dashboard

A personal dashboard and search interface built for Cloudflare Pages. Combines a home dashboard with live clock, RSS feed, app links, and bookmarks with a powerful search mode that queries TMDB, Wikipedia, and your bookmarks in real-time.

## Features

### Home Mode
- **Live Clock**: Displays current time and date, updated every second
- **Nextcloud News Feed**: Shows latest unread RSS items from your Nextcloud News instance
- **App Links**: Quick access links loaded from `applinks.txt`
- **Bookmarks Tree**: Collapsible folder tree parsed from Brave/Chrome bookmarks export

### Search Mode
- **Real-time Suggestions**: As you type, get suggestions from:
  - **TMDB**: Movies and people from The Movie Database
  - **Wikipedia**: Article titles with descriptions
  - **Bookmarks**: Your saved bookmarks matching the query

- **Rich Result Display**:
  - **Movies**: Overview, metadata table (budget, box office, runtime), poster, and clickable cast photos
  - **People**: Biography, birth info, profile photo, and clickable known-for movies
  - **Wikipedia**: Article intro, table of contents, infobox, and external links with favicons

- **AI Fallback**: When no direct results are found:
  - Links to DuckDuckGo, Google Images, and Perplexity
  - AI-generated answer via OpenRouter
  - Quick search icons for popular services

## Setup

### 1. Prerequisites

- A Cloudflare Pages account (or any static hosting)
- API Keys (optional but recommended):
  - [TMDB API Key](https://www.themoviedb.org/settings/api) (free)
  - [OpenRouter API Key](https://openrouter.ai/) (paid, optional)
  - Nextcloud instance with News app (optional)

### 2. Configure API Keys

Edit `script.js` and update the `CONFIG` object at the top of the file:

```javascript
const CONFIG = {
    // TMDB API Key - Get from https://www.themoviedb.org/settings/api
    TMDB_API_KEY: 'YOUR_TMDB_API_KEY_HERE',

    // OpenRouter API Key - Get from https://openrouter.ai/
    OPENROUTER_API_KEY: 'YOUR_OPENROUTER_API_KEY_HERE',

    // Nextcloud News Configuration
    NEXTCLOUD_URL: 'https://cloud.jumperlink.net',  // Your Nextcloud URL
    NEXTCLOUD_USER: 'YOUR_USERNAME',                // Your username
    NEXTCLOUD_PASS: 'YOUR_PASSWORD_OR_APP_TOKEN',   // App password recommended

    // ... rest of config
};
```

**Important**:
- Use Nextcloud app passwords instead of your main password
- Generate app password at: Nextcloud Settings > Security > Devices & sessions

### 3. Customize Your Links

#### App Links (`applinks.txt`)

Format: `URL "Display Name" "icon.svg"`

```
https://github.com/ "github" "github.svg"
https://mail.example.com "mail" "mail.svg"
```

The icon field is optional and currently not used (reserved for future enhancement).

#### Bookmarks (`bookmarks/bookmarks.html`)

1. Export bookmarks from your browser:
   - **Brave/Chrome**: `⋮` menu > Bookmarks > Bookmark manager > `⋮` > Export bookmarks
   - **Firefox**: `☰` menu > Bookmarks > Manage bookmarks > Import and Backup > Export Bookmarks to HTML

2. Save the exported file as `bookmarks/bookmarks.html`

The dashboard will parse the Netscape bookmark format and create a collapsible folder tree.

### 4. Deploy to Cloudflare Pages

1. Push your code to a Git repository (GitHub, GitLab, etc.)
2. Log in to [Cloudflare Dashboard](https://dash.cloudflare.com/)
3. Go to Pages > Create a project
4. Connect your Git repository
5. Configure build settings:
   - **Framework preset**: None
   - **Build command**: (leave empty)
   - **Build output directory**: `/`
6. Click "Save and Deploy"

Your dashboard will be live at `https://your-project.pages.dev`

## Usage

### Home Mode

When you first load the page, you'll see:
- Current time and date in the header
- News feed in the top panel
- App links in the text area
- Bookmarks tree in the dock/links area

### Entering Search Mode

Click or tap the search icon (🔍) on mobile (bottom right) or desktop (top right).

The interface transforms:
- Title becomes a full-width search bar
- Close button (×) appears to return to home
- Type to see real-time suggestions

### Selecting Results

- **Click/tap** a suggestion to view it
- **Press Enter** to select the first suggestion
- **Press Escape** to exit search mode
- **Click cast photos** in movie results to view actor details
- **Click known-for posters** in person results to view those movies

### Fallback Mode

If your search has no direct matches:
- Quick links to DuckDuckGo, Google Images, and Perplexity appear
- An AI answer (if OpenRouter configured) is generated
- Dock shows clickable icons for various search engines

## File Structure

```
wiki/
├── index.html              # Main HTML structure
├── script.js               # All JavaScript functionality
├── body.css                # Main CSS (includes fonts, grid, polish)
├── top.css                 # Legacy - merged into body.css
├── bottom.css              # Legacy - merged into body.css
├── applinks.txt            # Your custom app links
├── bookmarks/
│   └── bookmarks.html      # Exported browser bookmarks
├── fonts/
│   ├── ProLisa-Regular.ttf
│   ├── ProLisa-Bold.ttf
│   └── ProLisa-RegularItalic.ttf
└── README.md               # This file
```

## Customization

### Fonts

The dashboard uses **ProLisa** font by default, with fallbacks to Input Sans Narrow and system fonts. Font files are loaded from the `fonts/` directory.

To use different fonts:
1. Replace font files in `fonts/`
2. Update `@font-face` rules in [body.css](body.css)

### Colors & Theme

The dashboard uses a dark theme (black background, white text) with blue accent links (`#4a9eff`).

To customize colors, edit the CSS variables in [body.css](body.css):

```css
body {
    background: black;      /* Main background */
    color: white;           /* Main text */
}

a {
    color: #4a9eff;         /* Link color */
}
```

### Layout

The layout uses CSS Grid with responsive breakpoints:

- **Portrait (mobile)**: Stacked vertically (top over bottom)
- **Landscape (desktop)**: Side by side (bottom on left, top on right)

Breakpoint: `@media (min-aspect-ratio: 1.1/1)`

### Development Mode

The CSS includes colored outlines for each grid area to help visualize the layout structure during development:

- Blue: top
- Purple: bottom
- Green: header
- Yellow: overview
- Cyan: text
- Pink: links
- Lime: dock

To remove these outlines for production, uncomment the section at the end of [body.css](body.css).

## API Details

### TMDB (The Movie Database)

- **Search**: Multi-search endpoint for movies and people
- **Details**: Movie details with credits appended
- **Images**: Poster and profile photos via image CDN
- **Docs**: https://developer.themoviedb.org/docs/getting-started

### Wikipedia

- **Search**: OpenSearch API for title suggestions
- **Content**: Parse API for article HTML
- **CORS**: Requires `origin=*` parameter
- **Docs**: https://www.mediawiki.org/wiki/API:Main_page

### Nextcloud News

- **API**: v1.3 REST API
- **Auth**: HTTP Basic (base64 encoded username:password)
- **Endpoint**: `/index.php/apps/news/api/v1-3/items`
- **Docs**: https://nextcloud.github.io/news/api/

### OpenRouter

- **Purpose**: AI-powered answers for queries with no matches
- **Model**: Defaults to `openai/gpt-3.5-turbo`
- **Cost**: Pay-per-use (check OpenRouter pricing)
- **Docs**: https://openrouter.ai/docs

## Browser Support

Tested and working in:
- Chrome/Chromium 90+
- Firefox 88+
- Safari 14+
- Edge 90+

Requires:
- ES6+ JavaScript support
- CSS Grid support
- Fetch API
- DOMParser

## Security Considerations

**⚠️ Important**: API keys are embedded in the client-side JavaScript and will be visible to anyone who views your page source.

For a personal dashboard deployed to your own domain, this is generally acceptable. However, for production use:

1. **Use Cloudflare Workers** as an API proxy to hide keys server-side
2. **Implement rate limiting** to prevent abuse
3. **Use Nextcloud app passwords** instead of your main password
4. **Restrict TMDB API** to your domain if possible

## Troubleshooting

### News feed not loading
- Check Nextcloud credentials in `script.js` CONFIG
- Verify Nextcloud News app is installed and configured
- Check browser console for CORS or authentication errors
- Create an app password: Nextcloud Settings > Security

### TMDB search not working
- Get an API key from https://www.themoviedb.org/settings/api
- Update `TMDB_API_KEY` in `script.js`
- Check browser console for API errors

### Bookmarks not appearing
- Ensure `bookmarks/bookmarks.html` exists
- Export bookmarks from your browser in HTML format
- Check browser console for parsing errors

### Search not responding
- Check that `script.js` is loading (view page source)
- Look for JavaScript errors in browser console
- Try hard refresh: Ctrl+Shift+R (Windows/Linux) or Cmd+Shift+R (Mac)

### Fonts not loading
- Verify font files exist in `fonts/` directory
- Check font file names match `@font-face` declarations in CSS
- Check browser console for 404 errors

## Credits

- **Fonts**: ProLisa, Input Sans Narrow
- **APIs**: TMDB, Wikipedia MediaWiki, Nextcloud News, OpenRouter
- **Icons**: Browser favicons via Google's favicon service
- **Built for**: Cloudflare Pages static hosting

## License

Personal use project. Configure with your own API keys and credentials.

---

**Version**: 1.0
**Last Updated**: 2025-11-14
**Built with**: Vanilla JavaScript, CSS Grid, Love ❤️
