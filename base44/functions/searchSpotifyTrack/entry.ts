import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { query, year } = await req.json();
    if (!query) {
      return Response.json({ error: 'Query required' }, { status: 400 });
    }

    // Get Spotify access token
    const clientId = Deno.env.get('SPOTIFY_CLIENT_ID');
    const clientSecret = Deno.env.get('SPOTIFY_CLIENT_SECRET');
    
    if (!clientId || !clientSecret) {
      return Response.json({ error: 'Spotify credentials not configured' }, { status: 500 });
    }

    // Get access token via Client Credentials flow
    const authString = btoa(`${clientId}:${clientSecret}`);
    const tokenRes = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${authString}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });

    if (!tokenRes.ok) {
      return Response.json({ error: 'Failed to get Spotify token' }, { status: 500 });
    }

    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;

    // Search for track
    const searchQuery = year ? `${query} year:${year}` : query;
    const searchRes = await fetch(
      `https://api.spotify.com/v1/search?q=${encodeURIComponent(searchQuery)}&type=track&limit=1`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    );

    if (!searchRes.ok) {
      return Response.json({ error: 'Search failed' }, { status: 500 });
    }

    const searchData = await searchRes.json();
    const track = searchData.tracks?.items?.[0];

    if (!track || !track.preview_url) {
      return Response.json({ error: 'No preview available' }, { status: 404 });
    }

    return Response.json({
      id: track.id,
      name: track.name,
      artist: track.artists?.[0]?.name || 'Unknown',
      preview_url: track.preview_url,
      image_url: track.album?.images?.[0]?.url,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});