# Swup Performance Analysis Summary

## Core Swup Configuration

### `/src/scripts/swup.ts`

- Initializes Swup with plugins: PreloadPlugin, HeadPlugin, ScriptsPlugin, DebugPlugin
- Sets up hooks for page transitions:
  - `page:view` - Runs initialization functions (color switcher, carousel)
  - `content:replace` - Runs cleanup functions
- Manages initialization and cleanup of components during navigation

### `/src/layouts/Layout.astro`

- Base layout that includes the Swup script
- Defines CSS transitions for page animations
- Contains the main structure with `#swup` container

### `/src/layouts/SiteLayout.astro`

- Contains the main site structure with navigation and footer
- Defines the `#swup` container where page content is replaced

## Component Scripts

### `/src/scripts/carousel.ts`

- Initializes Glide.js carousel for mobile devices only
- Handles cleanup of carousel instances on page transitions
- Manages responsive behavior (destroy on desktop, create on mobile)

### `/src/scripts/backgroundColorSwitch.ts`

- Manages color theme switching based on keyword clicks
- Applies colors to background and Swup overlay
- Uses nanostores for persistent color state

### `/src/scripts/hls-video.ts`

- Custom web component for HLS video playback
- Handles video initialization and cleanup
- Integrates with Cloudflare Stream for video delivery

## Heavy Components

### `/src/components/react/BackgroundGradient.tsx`

- React component using React Three Fiber for WebGL gradients
- Renders animated gradient backgrounds using shaders
- Uses `client:only="react"` directive for client-side rendering

### `/src/components/r3f/GradientPlane.tsx`

- Three.js component that renders the gradient shader
- Uses `useFrame` hook for animation updates
- Implements shader material with time-based animations

### `/src/shaders/gradient_bg/gradient.frag`

- Fragment shader for gradient generation
- Implements noise-based distortion and blur effects
- Uses cosine gradient color interpolation

### `/src/components/astro/blocks/VideoBlock.astro`

- Renders video blocks with HLS streaming
- Integrates with Background component for styling
- Handles responsive layout positioning

## Navigation and Layout

### `/src/components/astro/Navigation.astro`

- Main navigation component
- Uses `getRelativeLocaleUrl` for i18n links

### `/src/components/astro/NavItem.astro`

- Individual navigation item with hover effects
- Applies transition styles for smooth interactions

### `/src/components/astro/Logo.astro`

- Site logo component linking to home page
- Uses ImageWrapper for optimized image display

## Content Rendering

### `/src/components/astro/BlockRenderer.astro`

- Renders different block types (title, video, image, text)
- Implements lazy loading for images after the first 3 blocks
- Dynamically selects appropriate component based on block type

### `/src/components/astro/GroupRenderer.astro`

- Renders groups of blocks for case study pages
- Handles responsive grid layout

## Utility Files

### `/src/utils/gradients.ts`

- Generates gradient uniforms for WebGL shaders
- Implements color variation and cosine gradient calculations
- Provides fallback gradient specifications

### `/src/stores/keywordStore.ts`

- Nanostores implementation for persistent color state
- Manages keyword color selection across page transitions

## Performance Considerations

1. **Scripts Plugin**: Currently re-executes all scripts on every page transition
2. **WebGL Components**: BackgroundGradient and GradientPlane are computationally expensive
3. **Video Components**: HLS videos are reinitialized on each navigation
4. **Carousel**: Glide.js is reinitialized on mobile for every page view
5. **Event Listeners**: Color switcher adds new listeners on each page view
6. **No Script Persistence**: Heavy components like WebGL gradients are recreated unnecessarily

## Potential Issues

1. SwupScriptsPlugin lacks specific configuration for script persistence
2. Heavy components (WebGL, video) are not optimized for repeated initialization
3. No cleanup of event listeners in color switcher
4. Carousel initialization happens on every page view regardless of content
5. No performance monitoring to identify bottlenecks
