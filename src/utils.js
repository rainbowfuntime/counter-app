import { ARTIST_ALIASES } from './data';

export function formatDate(date) {
  if (!date) return 'Unknown date';
  return new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function isUpcoming(entry) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return entry.pending || new Date(`${entry.date}T00:00:00`) >= today;
}

export function parseArtists(artistString) {
  return artistString
    .split(' / ')
    .map((a) => a.trim())
    .filter(Boolean);
}

export function normalizeArtist(name) {
  const key = name.toLowerCase().trim();
  return ARTIST_ALIASES[key] || name.trim();
}

export function favoriteLabel(value) {
  if (value === 'star') return '★';
  if (value === 'doublestar') return '★★';
  return '☆';
}

export function applyFilters(entries, filters) {
  const search = filters.search.toLowerCase().trim();
  return entries
    .filter((entry) => (filters.showUpcoming ? true : !isUpcoming(entry)))
    .filter((entry) => {
      if (filters.year === 'all') return true;
      return new Date(entry.date).getFullYear().toString() === filters.year;
    })
    .filter((entry) => (filters.type === 'all' ? true : entry.type === filters.type))
    .filter((entry) => {
      if (filters.favorite === 'all') return true;
      return entry.favorite === filters.favorite;
    })
    .filter((entry) => {
      if (!search) return true;
      const haystack = [entry.artist, entry.opener, entry.venue, entry.city, ...(entry.crew || [])]
        .join(' ')
        .toLowerCase();
      return haystack.includes(search);
    })
    .sort((a, b) => {
      const diff = new Date(a.date) - new Date(b.date);
      return filters.order === 'oldest' ? diff : -diff;
    });
}
