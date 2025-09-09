# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## 🚀 Quick Start Commands

This is Spring's personal blog website built with Astro, Tailwind CSS, and DaisyUI.

### Development
```bash
npm install          # Install dependencies
npm run dev          # Start development server (http://localhost:4321)
npm run build        # Build for production (outputs to dist/)
npm run preview      # Preview production build locally
```

### Key Development Notes
- Dev server includes hot reloading for all file types
- Astro's view transitions are enabled but disabled on PlayStation browsers
- Images are optimized using `astro-better-image-service`

## 🏗️ Architecture Overview

**Stack**: Astro 5 + Tailwind CSS 4 + DaisyUI + TypeScript

**Architecture Pattern**: Static Site Generation with Astro Islands
- **Content**: Markdown files in `src/posts/` → Astro Content Collections
- **Styling**: Tailwind CSS classes + DaisyUI components + Custom theme system
- **Interactivity**: Minimal client-side JS for theme switching and PlayStation compatibility
- **Deployment**: GitHub Pages with automated builds on push to master

```
Content Flow:
Markdown Posts → Astro Content Collections → Static Pages → GitHub Pages

Theme System:
localStorage + DaisyUI themes → CSS custom properties → View transition persistence
```

## ✍️ Content System

The site uses Astro Content Collections for blog posts.

### Post Schema
Posts are stored in `src/posts/` with this frontmatter structure:

```typescript
// From src/content.config.ts
schema: z.object({
    hero: z.string().optional(),        // Hero image path
    title: z.string(),                  // Post title
    description: z.string().optional(), // Meta description
    tags: z.array(z.string()).optional(), // Post tags
    pubDate: z.coerce.date(),          // Publication date
    updatedDate: z.coerce.date().optional(), // Last updated
    draft: z.boolean().optional()       // Draft status
})
```

### Adding New Posts
1. Create `src/posts/your-post.md`
2. Add required frontmatter (title, pubDate minimum)
3. Write content in Markdown
4. Images go in `public/images/posts/`
5. Reference images as `/images/posts/filename.ext`

## 🧭 Navigation System

**Responsive Navigation**:
- **Desktop**: Sticky top navbar with text labels
- **Mobile**: Bottom dock with icon labels only
- **Theme Toggle**: Available in desktop navbar

### Navigation Components
- `src/components/navigation/Navigator.astro` - Main wrapper
- `src/components/navigation/components/NavLabel.astro` - Desktop nav items
- `src/components/navigation/components/DockLabel.astro` - Mobile dock items

### Key Routes
- `/` - Homepage with profile and projects
- `/posts` - Blog post listing
- `/posts/[slug]` - Individual blog posts
- `/about` - About page

## 🎨 Theme System

Built on DaisyUI's theme system with localStorage persistence.

### Theme Implementation
```javascript
// Theme is managed via data-theme attribute
document.documentElement.setAttribute('data-theme', themeName);

// Themes persist through view transitions
// See src/layouts/Layout.astro for implementation
```

### Available Themes
- Light (default)
- Dark
- Additional DaisyUI themes can be added in theme selector

**Important**: Theme state persists through Astro view transitions using `transition:persist` directive.

## 🔄 View Transitions & PlayStation Compatibility

The site uses Astro's View Transitions API with a special compatibility layer.

### PlayStation Browser Handling
```javascript
// In src/components/navigation/Navigator.astro
function isPlayStation() {
    const userAgent = navigator.userAgent.toLowerCase();
    return userAgent.includes('playstation') || 
           userAgent.includes('ps4') || 
           userAgent.includes('ps5');
}
```

**Why**: PlayStation browsers (PS4/PS5) crash with view transitions enabled. The site detects PlayStation user agents and disables all transitions/animations.

### Custom Transitions
- **Animation**: Scale in/out effect defined in `src/lib/animations.ts`
- **Duration**: 0.2s out, 0.5s in with cubic-bezier easing
- **CSS**: Scale keyframes defined in `src/layouts/Layout.astro`

## 🚢 GitHub Pages Deployment

Automated deployment via GitHub Actions.

### Deployment Workflow
**File**: `.github/workflows/deploy_and_archive.yml`

**Process**:
1. Triggers on push to `master` branch
2. Builds with `npm ci && astro build`
3. Deploys to GitHub Pages
4. Archives to Wayback Machine

**Manual Deployment**: 
Not available - deployment is automatic only.

### Build Output
- Static files generated to `dist/`
- Site URL: https://bloomdevelop.github.io
- Custom domain: Not configured

## 🧩 Project Structure & Patterns

```
src/
├── assets/          # Static assets (SVGs, global CSS)
├── components/      # Reusable Astro components
│   ├── navigation/  # Navigation-specific components
│   └── Repositories.astro # Project showcase
├── content.config.ts # Content collection schema
├── constant.ts      # Site constants (author name, roadmap)
├── layouts/         # Page layout components
│   ├── Layout.astro      # Base layout with nav
│   └── PostLayout.astro  # Blog post layout
├── lib/            # Utility functions and types
│   ├── animations.ts # View transition configurations
│   └── types.ts     # TypeScript type definitions
├── pages/          # File-based routing
│   ├── about.astro
│   ├── index.astro  # Homepage
│   └── posts/       # Blog routing
└── posts/          # Markdown blog content
```

### Key Architectural Patterns

**Layout Inheritance**:
- `Layout.astro` provides base structure + navigation
- `PostLayout.astro` extends with blog-specific features
- All pages use slots for content injection

**Component Composition**:
- Small, focused components (NavLabel, DockLabel)
- Props-based configuration
- Consistent DaisyUI class usage

**Type Safety**:
- TypeScript throughout
- Zod schemas for content validation
- Proper interface definitions in `lib/types.ts`

## 🛠️ Development Guidelines

### Constants & Configuration
- Site author name: `AUTHOR_NAME` in `src/constant.ts`
- Project roadmap: `roadmap_array` in `src/constant.ts`
- Modify these instead of hardcoding values

### Image Handling
- Use `astro:assets` Picture component for optimization
- Store images in `public/images/`
- Hero images: `public/images/posts/`
- Profile images: `public/images/pfp/`

### Styling Approach
- Tailwind CSS utility classes
- DaisyUI component classes (`btn`, `card`, `navbar`, etc.)
- Custom CSS only in `src/assets/global.css`
- Responsive design: mobile-first with `lg:` prefix

### Analytics
- Umami analytics configured in Layout.astro
- Script loads from cloud.umami.is
- Website ID: `32517f0f-d824-4a46-8eed-c7948403e966`

## 📝 Content Creation Tips

1. **Blog Posts**: Use meaningful slugs (filename becomes URL)
2. **Images**: Optimize before adding to avoid large builds  
3. **Dates**: Use `MM/DD/YY` format in frontmatter
4. **Tags**: Keep consistent (use existing tags when possible)
5. **Drafts**: Set `draft: true` to hide from production

## 🔧 Troubleshooting

**Common Issues**:
- **Theme not persisting**: Check localStorage in browser dev tools
- **View transitions broken**: Might be PlayStation browser - check console logs
- **Images not loading**: Verify paths start with `/` for public directory
- **Build fails**: Check all frontmatter dates are valid format

**Development Server**:
- Port 4321 (default Astro port)
- Clear browser cache if theme switching isn't working
- Restart dev server after config file changes
