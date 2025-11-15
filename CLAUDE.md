AI System Prompt: Jumperlink Dashboard Core Guidelines
UI Modes and Core Functionality

Maintain Dual Modes: The application must always support two modes – Home Mode and Search Mode – with clear distinctions.

Home Mode: On load or when no search is active, display the current time as the page title and the current date as the subtitle (e.g. “HH:MM” as title, “Weekday, Month DD, YYYY” as subtitle). This live clock should update every second.

Search Mode: Activated by the search trigger (🔍) or focusing the search bar. In this mode, the title area transforms into an input field for queries (and the static clock title is hidden). The subtitle (date) is hidden during search. Ensure the search input automatically gains focus and is ready for typing on mode entry. Pressing Escape should exit search mode and return to home mode (restoring time/date display). Pressing Enter selects the top suggestion or triggers a fallback search if none are listed.

Mode Toggle Behavior: The search trigger button should toggle between opening search (🔍 icon, labeled “Open search”) and closing search (✕ icon, labeled “Close search”). On desktop, this button is shown in the top header; on mobile, it’s shown at the bottom-right. The button’s icon and ARIA label must update appropriately when modes switch. The transition between modes should not remove content improperly: when entering search, preserve the home content in the background until new results appear (e.g. don’t clear bookmarks or app links immediately, except the feed in overview which can be cleared for suggestions).

Layout and Interface Structure

Preserve Sectioned Layout: Keep the HTML structure divided into a <top> and <bottom> section. The <top> section contains the header (title/subtitle and optional top search button) and an overview panel. The <bottom> section contains the text area and the links area. This separation is fundamental — do not collapse or rename these sections. They map to major UI regions:

Header (<header>): Holds the page title/search input and subtitle (and on wide screens, the search button). The header should remain at the top of the interface in home mode.

Overview (<overview>): In home mode, this is used for high-level information (e.g. the RSS feed cards). In search mode, this area is repurposed for dynamic content like suggestion lists or auxiliary info (table of contents, infoboxes, etc. for results).

Text (<text>): A scrollable container for detailed textual content. In home mode this might remain relatively empty or show placeholder info (like the bookmarks tree as currently implemented); in search results, it displays main content (article text, movie overview, person biography, etc.).

Links/Dock (<links> and its child <dock>): The “dock” is used for collections of link icons or buttons. In home mode it contains quick-access app links (and possibly the bookmark tree or other links if specified). In search mode, the dock is used to display related external links or media (e.g. cast thumbnails, external search engine icons). The <links> container wraps the dock and may also include the bottom search trigger in mobile view. Do not remove or repurpose the <dock> element – it should consistently be used for holding sets of icons/links (app shortcuts, external links, cast/known-for images, etc., depending on context).

Responsive Design Integrity: Maintain the responsive grid layout as designed. On narrow/mobile screens, the default layout is two rows (top above bottom). On wider screens, the layout switches to two columns (with the bottom section on the left and the top section on the right, as implemented). Do not alter this breakpoint or swap the intended positions of top/bottom in each orientation. Ensure that in all views:

The overview and text areas are scrollable (with overflow auto) so content can extend without breaking the layout.

The dock icons area can scroll horizontally if content exceeds width (e.g. many app links) and does not overflow its container vertically.

Font sizes and container sizes remain balanced for readability (e.g. the page title/input should stay ~1.8rem). Avoid adding elements that disrupt the existing CSS grid or flex structure.

Semantic HTML Elements: Continue using the custom semantic elements (<top>, <bottom>, <main-text>, <page-title>, <subtitle>, <overview>, <text>, <links>, <dock>) as structural hooks. Do not rename or remove these elements or their classes/IDs – the CSS and JS rely on them. For example, the input field must remain id="searchbox" inside <page-title>, and the search buttons must keep class search-trigger. Preserve these to ensure styles and scripts apply correctly (such as .page-title-display for the clock text, .page-title-input for the hidden search box, etc.). The layout hierarchy and element naming are considered contracts; future changes should extend them, not replace them.

Home Mode Content and Features

Live Clock Title: Ensure the home mode always initializes by calling an updateClock function (or equivalent) to set the current time in the title and date in subtitle. The clock should be accurate and updating (e.g. using setInterval) without drifting. The format should remain as originally specified (24-hour time for title, full weekday and date for subtitle, unless user preferences are introduced separately).

RSS Feed Overview: In home mode, the <overview> panel is dedicated to rendering the RSS feed from the Nextcloud News API. Preserve the mechanism to fetch feed folders and items via the configured Nextcloud endpoint. The feed display should remain in a card-based format (as in the current “bluesky-inspired” design) with a list of feed items. Do not remove feed controls: keep the folder filter buttons and the “unread/viewed” toggle chip to filter items. If Nextcloud credentials are not provided or the request fails, continue showing a friendly placeholder message in the overview (prompting configuration). Future changes must not break this feed integration or its controls.

App Links Dock: Continue loading quick launch links from applinks.txt and displaying them as icons in the dock area. The parsing format (“URL "Name" "icon"”) is fixed – future development should not change this format without good reason. All links from this file should render as clickable icons with labels: use either the specified icon image (if provided) or a favicon fallback for the link’s domain. Icons should be a comfortable size (e.g. 32px) and include a text label beneath or beside them (currently implemented as a title below each icon). Ensure this app links section remains easily extensible: if new links are added to the file, they should automatically appear without layout changes. Grouping or categorization (if introduced later) should preserve the horizontal scrolling strip style, or a similarly clean approach, rather than cluttering the UI.

Bookmark Tree: The user’s bookmark tree is displayed in home mode for quick reference. The application currently parses a bookmarks.html (Netscape format export) and builds a collapsible tree (using nested <details> elements). This functionality must remain intact:

Keep the collapsible folder structure with nested <details><summary> for folders and clickable <a> links for bookmarks. The root level may be expanded by default (as done now).

The bookmark tree is currently inserted into the <text> area in home mode. Continue to display it there (or in whichever section was designed) so that it occupies a distinct space from the app links. On wide screens, this appears in the left column (bottom section) providing a full view of bookmarks, while app icons remain docked perhaps at the bottom of that column – ensure this division is maintained for usability.

Do not alter the format of bookmarks parsing or the basic styling (folder names in a distinct color, indentation for hierarchy, etc.). New development should not remove the bookmark feature or bury it; it’s a core part of the dashboard’s utility.

Search Mode & Suggestions

Search Input Focus & Placeholder: When entering search mode, always clear or select the existing text in the input (as currently done) so the user can start typing immediately. The placeholder text should remain a neutral prompt like “Search…” (and can be contextually present only when input is empty). Do not remove the ability to trigger search by clicking the search icon or by focusing the input field. Both methods (button click or focus) should seamlessly transition to search mode.

Real-Time Suggestions: As the user types, provide live suggestions from multiple sources, in parallel, without needing an explicit submit. The original design calls for suggestions from:

Wikipedia API: Continue using Wikipedia’s open search API to fetch article title suggestions (with short descriptions). Limit the count (e.g. 5 suggestions) to keep the list manageable. Each Wikipedia suggestion should be identifiable (e.g. prefixed with a “Wiki” icon or tag in the suggestion list).

TMDB (The Movie Database) API: Ensure integration (or future integration) with TMDB for movies and people search. Suggestions from TMDB should include movie titles or person names (with year or known-for info if possible) and be marked with a film or person icon. Even if the current version hasn’t implemented TMDB yet, any future development must add it according to the plan, without altering the suggestion UI structure – just include them alongside Wikipedia and bookmarks suggestions.

Browser Bookmarks: Include matches from the user’s bookmarks (by title or URL substring) as suggestions. These should be labeled distinctly (e.g. with a bookmark icon or “[Bookmark]” tag). The suggestions list UI should clearly indicate the type (use small icons or text prefixes as done now) but remain unified in one dropdown/list for easy keyboard navigation.

All suggestion sources should populate a single suggestions container (likely the <overview> area in search mode) in real-time. If multiple sources return results, combine them in a reasonable order (e.g. intermix or group by source, but do not favor one source to the exclusion of others unless specified). Do not hard-limit the architecture to only these sources – it should be straightforward to add more suggestion providers in the future following the same pattern (fetch in parallel, merge results, each with a type identifier and icon).

Suggestion Selection Behavior: Maintain the behavior that clicking on a suggestion item loads the result, and pressing Enter immediately selects the first suggestion if suggestions exist. The first suggestion should be consistently the top result from the combined list (e.g. highest relevance). Pressing Escape should cancel the search if no suggestion is selected (already returning to home). These controls must remain functional after any changes – do not remove the event listeners or the logic that enables keyboard navigation and selection of suggestions.

No-Results Handling: If the user’s query yields no suggestions from any source, preserve the fallback behavior:

The <overview> panel should display a short message like “No direct results. Try searching on:” followed by a few suggested external search links (e.g. DuckDuckGo, Google Images, Perplexity AI, etc.). These links provide the user a quick way to try their query elsewhere. Keep their styling simple and obvious (perhaps as a list or buttons).

Additionally, ensure the “Add to Tasks” quick action still appears in this scenario (e.g. a button to add the query as a task, if using Nextcloud Tasks integration). This is a secondary feature – it should remain available but not intrusive. Maintain the task modal functionality and ensure it stays triggered by that button.

In no-result cases, the system should automatically trigger an AI fallback answer (see next section) to be displayed in the text area. This should happen asynchronously (show a “Getting AI answer…” placeholder while the request is in progress). It’s important that this only occurs when no direct match was found – do not call the AI for every query, only as a fallback.

Search Results Display & Content Panels

Wikipedia Result Display: Preserve the rich display format for Wikipedia articles:

When a Wikipedia suggestion is selected, the app should fetch the full article content (using Wikipedia’s API parse endpoint as done). Then, in the text panel, display the article’s introduction and main content (cleaned of unnecessary references or edit links). Do not truncate the content too early – the user should be able to scroll through the majority of the article in the text area. Include a “Read more on Wikipedia” link at the end for convenience.

In the overview panel, show the article’s Table of Contents (major section headings) on the left side and the Infobox (if present) on the right side. This two-column overview layout must be maintained. The infobox (typically a <table> with key facts) should be styled with a subtle outline or border (e.g. 1px solid gray as currently) to set it apart. The TOC should be in a scrollable container if it’s long, and each item should be clickable – clicking a TOC entry scrolls the corresponding section into view in the text area. Keep this scroll-into-view functionality and smooth scrolling behavior.

Any external links found in the Wikipedia intro/content (those pointing outside Wikipedia) should continue to be collected and displayed as icons in the dock. Use the site’s favicon (as done via Google’s favicon service) for each external link icon, and limit the number to a reasonable count (e.g. the first 5 external links). This provides quick navigation to related sites. Ensure these icons are cleared or updated when a new search result is loaded to avoid stale links.

Internal Wikipedia links (links to other Wiki articles) should not open an external browser by default; instead, as implemented, intercept those clicks and load the new article within the app (staying in search mode). Preserve this behavior so the user can seamlessly navigate Wikipedia content within the dashboard.

TMDB Movie Result Display: When a movie result from TMDB is selected, follow the original design blueprint for presenting the information:

In the text area, show the movie’s overview/description (plot synopsis) in a readable paragraph form. If available, also show additional paragraphs or tagline as appropriate, but the synopsis is primary.

In the overview panel, present a structured table or list of key metadata about the movie. This should include fields like release date, runtime, genre, director, rating, budget, box office, etc., as available from the TMDB data. Using a table with two columns (field name and value) is acceptable; outline it subtly (gray border) to match the style. Also include the movie’s poster image and/or backdrop if feasible – for example, you could show the poster alongside the info table. The layout should remain clean and not overflow the overview panel (use responsive scaling or max-width for images).

In the dock area, display the top-billed cast as a series of clickable thumbnails. For each top cast member, use their profile picture (from TMDB) as an icon, and clicking it should load that person’s details (triggering a person result view). Ensure these images have appropriate alt text (e.g. actor name) and a consistent size (such as 64px or similar) so they align nicely. The dock should scroll if cast list is too long. This approach must remain consistent: the dock is the place for supplementary visuals or links related to the result (cast in this case).

If any of these elements (poster, cast images, etc.) fail to load or are missing, the UI should handle it gracefully (e.g. hide that element or show a placeholder, but do not break layout). Always include at least the textual info so the user gets a useful result.

TMDB Person Result Display: When a person (actor/filmmaker) result from TMDB is selected:

The text panel should show the person’s biography or a summary of their career, as provided by the API. Ensure it’s presented in paragraph form and is scrollable if lengthy.

The overview panel should list key personal details in a structured format. For example, show their birth date, birthplace, perhaps known aliases, and other notable facts. Also include the person’s profile photo image in this panel, displayed at a reasonable size. Similar to the movie infobox, use a clear layout (e.g. a two-column table or a simple card) to present this information cleanly.

The dock should feature the person’s known-for movies (or shows) as clickable poster thumbnails. Retrieve a handful of top known-for titles (posters) from TMDB and display them here. Each poster image should link to that movie’s detail view (i.e. selecting it will trigger a TMDB movie result display as above). Keep image sizing uniform and use scroll or grid in the dock if multiple posters are shown. This gives the user an interactive way to explore the person’s work.

As always, ensure images have alt text and that missing images don’t break the layout. The emphasis is on preserving the intended structure: bio text in main area, facts + photo in overview, and related works in dock.

AI Answer Fallback: If no direct results were found and the AI query is triggered, handle it exactly as designed:

The text area should show a brief note (e.g. italic gray preface “AI-generated answer:”) followed by the answer from the OpenRouter API. The answer must be escaped or sanitized as needed (to avoid injection of unwanted HTML) and presented in a readable format (simple paragraphs). Do not add extra commentary – just display the answer as the AI response to the query. After the answer, you can include a link or prompt to “Continue conversation” on the chat platform (as currently done with a link to chat.jumperlink.net) so the user knows they can follow up interactively.

If the OpenRouter API call fails or no key is configured, gracefully handle this by informing the user (e.g. an error message in text area: “Unable to get AI answer. Configure OpenRouter API key.” and perhaps a link to the chat service as an alternative). This ensures the dashboard doesn’t hang silently if AI is unavailable.

Meanwhile, the overview panel in this scenario is already showing external search suggestions (DuckDuckGo, etc.), which should remain visible. And the dock is populated with quick-search icons (like DuckDuckGo, Google Images, YouTube, chat) for one-click access. This tripartite fallback (overview links, AI answer in text, icons in dock) is a core design for empty results – it must be preserved and kept up-to-date with any new services (but do not remove any of the existing ones without good reason). Keep the style of these elements consistent (e.g. icon size in dock 32px, nicely aligned).

Styling and Theming Standards

Typography: Continue using the ProLisa font as the primary display font, with fallbacks to Input Sans and system sans-serif fonts. The aesthetic of the dashboard is defined by this font choice – do not replace it arbitrarily. Font files are loaded locally; ensure any future font changes are deliberate and accompanied by corresponding CSS updates. The overall font size should remain user-friendly (base ~16px, with larger size for titles). Avoid making text too small or too large in new features – follow the scale already in use (e.g. subtitles slightly smaller than title, body text at 1rem, etc.).

Color Scheme: The application uses a dark theme consistently: black (or near-black) background with white (or light gray) text, and a distinctive blue accent (#4a9eff) for interactive elements like links and highlights. All new UI elements should conform to this scheme. For example, any new buttons or links you introduce should use the blue accent for hover or active states and not introduce unrelated colors. Continue to use subtle gray outlines/borders to delineate sections or tables (as seen with the infobox outline or feed item borders). Maintain sufficient contrast for readability (especially for smaller text, ensure it’s not low-contrast gray on black).

Spacing and Sizing: Preserve the current spacing conventions – small padding around containers (often ~1% or 0.5rem) so content isn’t flush to edges, and a gap of ~1% in grid layouts. Do not overcrowd the interface with new elements; any added component should have adequate margin/padding to fit with the existing design. Keep interactive targets (buttons, links) reasonably sized for touch on mobile. The scrollable areas (overview, text, dock when horizontal) should have some padding inside to avoid content touching edges. Maintain the scrollbar hidden style for a clean look (scrollbars are hidden via CSS except for actual scrolling action).

Responsive Behavior: Ensure that all features remain usable on different screen sizes. The layout should continue using CSS media queries as defined (aspect-ratio based). If adding new UI components, test them in both mobile and desktop layouts. They should either flow within the existing grid or flex layout, or have their own responsive rules. Do not introduce fixed-width elements that could break on smaller screens; use relative sizing or max-width constraints consistent with the existing CSS. The design should remain fluid and avoid horizontal scrolling except in designated areas (like the dock for icons).

Consistency in Elements: Follow existing styling for similar elements. For instance, if adding a new section in the overview or a new kind of panel, use a style similar to the feed cards or infoboxes where appropriate (rounded corners, translucent backgrounds, subtle shadows or borders). The aim is to maintain a cohesive look throughout the app. Do not suddenly use completely new styles (like light theme panels or different color buttons) that clash with the established dark theme and minimalistic design.

Preservation of Behavior and Extensibility

Maintain Existing IDs/Classes: Critical elements have specific IDs and classes (e.g. the search input is #searchbox, suggestion items use a certain class, etc.). These are tied to JavaScript logic (event listeners, DOM queries) and CSS selectors. Do not rename or remove these without updating all references accordingly. It’s safest to keep them unchanged. For example, .search-trigger buttons, .quick-search-links container, .suggestion-item class, etc., should remain as in the current implementation unless a compelling reason arises and all dependent code is adjusted. This avoids “drift” where future changes accidentally disconnect the JS from the HTML/CSS.

Event Handling and Interactivity: All interactive features (search toggling, suggestion clicking, feed item expansion/mark as read, task modal, etc.) must continue to work after changes. When modifying or extending functionality, do not disable or block existing event listeners. For instance, if adding new buttons or links, ensure they don’t overlap or conflict with the click targets of current elements. Keep the use of event delegation or direct listeners consistent with current patterns. The history/navigation behavior (using pushState for search queries and handling popstate to allow back-button navigation between modes) should remain in place – don’t remove the URL parameter logic that enables direct linking to searches or wiki articles (?q= or ?wiki= in URL).

Client-Side Only: The app is meant to run entirely in the user’s browser (static site). Do not introduce server-side requirements or dependencies that break static deployment. All data needs should be met via client-side calls (APIs or local files). If you integrate new APIs or features, ensure CORS is handled and no server proxy is assumed. The build/deployment should remain just static files (HTML/CSS/JS and assets). Keep any configuration (like API keys or endpoints) in the client CONFIG object or similar, not hidden server logic.

Core Feature Parity: When extending the application, use the core functionality as a model. New search sources or content types should follow the established pattern of suggestions → selection → content display across overview/text/dock. New dashboard features (e.g. additional widgets in home mode) should fit into either the overview or bottom sections logically and not override existing ones. For example, if adding a weather widget, it might go in overview below the news feed, but should not replace the feed or push out the time/title. Always preserve the original features unless explicitly replacing with an improved version as part of a planned change.

Scalable Architecture: The code structure (with clear functions like loadAppLinks, displayBookmarksTree, enterSearchMode, etc.) should remain modular. When adding code for new features, mirror the style and organization: use self-contained functions and update the state management object (STATE) or config as needed rather than writing ad-hoc logic that could clutter or break things. Avoid global side effects that aren’t accounted for in state. This makes sure future contributors or AI iterations can scale the project without unintended side-effects. In short, extend gracefully – plug into the existing systems (for example, add a new suggestion source by adding a new function and including it in the Promise.all for performSearch, rather than rewriting how suggestions are displayed).

Prevent Regression of UX: Any future iteration must be checked against these core behaviors to avoid regressions. Before finalizing changes, the assistant should effectively verify:

Does the page still show time/date on load?

Can the user toggle to search and back seamlessly?

Do all original sources (Wikipedia, bookmarks, etc.) still work in suggestions and results?

Is the layout intact (nothing misaligned or overflowing)?

Are all interactive elements (buttons, links, TOC items, etc.) responding as expected?
If any core functionality as described is broken by a change, that change should be reconsidered or reworked. The goal is to preserve the user experience and interface contract that has been established while allowing the code to evolve internally.

By adhering to these guidelines, you will ensure that the Jumperlink Dashboard’s core design, functionality, and scalability principles remain consistent over time. Every change should reinforce or extend the original vision, not stray from it. Always prioritize keeping the home dashboard feel and search engine capabilities integrated just as initially designed, so users enjoy a reliable and familiar experience even as new features are introduced.