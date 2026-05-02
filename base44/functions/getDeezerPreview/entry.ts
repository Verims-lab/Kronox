import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Proxy: Deezer'dan preview URL çek (CORS'u önler)
// Ayrıca preview null ise alternatif şarkı arar

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { query } = await req.json();

    if (!query) {
      return Response.json({ error: 'query parametresi gerekli' }, { status: 400 });
    }

    // İlk arama
    const result = await searchDeezer(query);
    if (result) return Response.json(result);

    // Alternatif: sanatçı adını çıkar ve genel arama yap
    const shortQuery = query.split(' ').slice(0, 2).join(' ');
    if (shortQuery !== query) {
      const fallback = await searchDeezer(shortQuery);
      if (fallback) return Response.json({ ...fallback, isFallback: true });
    }

    return Response.json({ previewUrl: null, title: null, artist: null });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});

async function searchDeezer(query) {
  const res = await fetch(
    `https://api.deezer.com/search?q=${encodeURIComponent(query)}&limit=5`,
    { headers: { 'Accept': 'application/json' } }
  );
  if (!res.ok) return null;
  const data = await res.json();

  // preview URL olan ilk track'i bul
  const track = data?.data?.find(t => t.preview && t.preview.length > 0);
  if (!track) return null;

  return {
    previewUrl: track.preview,
    title: track.title_short || track.title,
    artist: track.artist?.name || 'Unknown',
    isFallback: false,
  };
}