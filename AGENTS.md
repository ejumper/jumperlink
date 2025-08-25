# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a static personal resume website built with vanilla HTML, CSS, and JavaScript. The site functions as a Single Page Application (SPA) that dynamically loads content into a main container without full page reloads.

## Architecture

### Core Structure
- **index.html**: Main entry point containing the header, navigation menu, and content container
- **main.js**: JavaScript module handling SPA navigation, content injection, and modal dialogs
- **style.css**: Complete stylesheet with CSS custom properties for responsive design
- **content/**: Directory containing HTML fragments that are dynamically loaded

### Key Components
1. **Header Section**: Fixed title bar with contact buttons and resume link
2. **Navigation Menu**: Four-item grid menu (Education, About Me, Home Labs, Work Experience)
3. **Content Box**: Dynamic container where HTML fragments are injected
4. **Modal Dialogs**: Contact information popups for email and phone

### Content Management
- Content is organized in HTML fragments under `content/` directory
- Home lab documentation stored in `content/labs/` with subdirectories by category:
  - `adds/`: Active Directory Domain Services labs
  - `ubuntu/`: Ubuntu server configuration labs  
  - `vm/`: VirtualBox virtual machine labs
  - `other/`: Miscellaneous technical projects
- Each lab includes detailed step-by-step documentation with screenshots

## Development

### No Build Process
This is a static site with no build tools, package managers, or dependencies. Simply serve the files directly from a web server.

### Local Development
- Use any HTTP server to serve files locally (e.g., `python -m http.server`, Live Server extension)
- No compilation, bundling, or preprocessing required

### Deployment
- Currently deployed on Cloudflare Pages
- Connected to GitHub repository for automatic deployment on push
- Custom domain configured through Cloudflare DNS

## Code Conventions

### CSS
- Uses CSS custom properties extensively for theming and responsive scaling
- HSL color system with centralized color variables in `:root`
- Responsive design using `clamp()` functions for fluid scaling
- Grid and flexbox layouts throughout

### JavaScript
- Vanilla JavaScript with no frameworks or libraries
- Module pattern with event delegation
- Implements History API for browser back/forward navigation
- Uses Fetch API for loading content fragments
- Includes accessibility features (ARIA labels, focus management)

### HTML
- Semantic HTML5 structure
- Accessibility considerations with proper ARIA attributes
- Content fragments are complete HTML sections that inject into main container

## Key Features

### Navigation System
- Hover previews on menu items (disabled when viewing lab content)
- Click to select and maintain state
- Dynamic content loading with caching
- Browser history integration

### Lab Documentation
- Grid-based lab overview with color-coded categories
- Individual lab pages with detailed technical documentation
- Screenshot integration for step-by-step guides
- Skills demonstration sections

### Responsive Design
- Single codebase works across all device sizes
- Uses advanced CSS scaling with viewport-based calculations
- Custom font loading with Ubuntu font family

## File Structure Notes
- `documents/`: Contains resume PDF
- `images/`: Navigation menu icons and profile images
- `fonts/`: Ubuntu font files in multiple formats
- `content/labs/images/`: Screenshots for lab documentation

This is a portfolio/resume site showcasing IT technical skills through documented home lab projects and certifications.