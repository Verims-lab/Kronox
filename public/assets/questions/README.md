# Kronox Question Card Media Assets

This directory stores static image assets for Kronox question cards.

## File Organization

Store question card images here with descriptive names:

```
/public/assets/questions/
  msn-messenger.webp
  gangnam-style.webp
  nokia-3310.webp
  walt-disney-sirketi-kurulus.webp
  ...
```

## Database Reference

In the Question entity, set `media_url` to reference these assets:

```json
{
  "question": "Walt Disney Şirketi hangi yılda kuruldu?",
  "year": 1923,
  "category": "sanat",
  "type": "gorsel",
  "media_url": "/assets/questions/walt-disney-sirketi-kurulus.webp",
  "difficulty": 2
}
```

## Image Requirements

- **Format**: WebP, PNG, or JPEG
- **Aspect Ratio**: 16:9 recommended
- **Resolution**: 640×360px minimum (scales responsively)
- **File Size**: < 200KB for optimal loading
- **Naming**: lowercase, hyphens for spaces, descriptive

## Rendering

The game automatically renders images from `media_url`:

```jsx
{question?.media_url && (
  <img
    src={question.media_url}
    alt=""
    className="w-full h-full object-cover"
    referrerPolicy="no-referrer"
    crossOrigin="anonymous"
    onError={() => { /* fallback to gradient */ }}
  />
)}
```

If media_url is missing or the image fails to load, the card displays the Kronox fallback gradient and category icon.

## Build & Deployment

- **Local Dev**: Images load from `http://localhost:5173/assets/questions/`
- **Production**: Vite packages `/public` assets and serves them directly
- **PWA/WebView**: Static assets are bundled and cacheable

No runtime generation—all visuals are pre-prepared externally.
