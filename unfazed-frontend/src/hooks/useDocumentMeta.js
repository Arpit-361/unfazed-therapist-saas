import { useEffect } from 'react';

function setMeta(attr, key, content) {
  if (!content) return;
  let el = document.head.querySelector(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

/** Sets document title, description and Open Graph tags for the current page. */
export default function useDocumentMeta({ title, description, image, url, type = 'website' }) {
  useEffect(() => {
    if (title) document.title = title;
    setMeta('name', 'description', description);
    setMeta('property', 'og:title', title);
    setMeta('property', 'og:description', description);
    setMeta('property', 'og:image', image);
    setMeta('property', 'og:url', url || window.location.href);
    setMeta('property', 'og:type', type);
    setMeta('name', 'twitter:card', image ? 'summary_large_image' : 'summary');
  }, [title, description, image, url, type]);
}
