import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const clientId = Deno.env.get('SPOTIFY_CLIENT_ID');
    const clientSecret = Deno.env.get('SPOTIFY_CLIENT_SECRET');
    
    if (!clientId || !clientSecret) {
      return Response.json({ error: 'Spotify credentials not configured' }, { status: 500 });
    }

    // Get Spotify access token
    const authString = btoa(`${clientId}:${clientSecret}`);
    const tokenRes = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${authString}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });

    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;

    // Popular songs/artists list with approximate release years
    const songs = [
      { query: 'The Beatles Hey Jude', year: 1968 },
      { query: 'Pink Floyd Comfortably Numb', year: 1979 },
      { query: 'Led Zeppelin Stairway to Heaven', year: 1971 },
      { query: 'Queen Bohemian Rhapsody', year: 1975 },
      { query: 'David Bowie Space Oddity', year: 1969 },
      { query: 'The Rolling Stones Sympathy for the Devil', year: 1968 },
      { query: 'Jimi Hendrix Purple Haze', year: 1967 },
      { query: 'The Who My Generation', year: 1965 },
      { query: 'Black Sabbath Iron Man', year: 1972 },
      { query: 'Deep Purple Smoke on the Water', year: 1971 },
      { query: 'AC/DC Back in Black', year: 1980 },
      { query: 'Guns N\' Roses Sweet Child o\' Mine', year: 1988 },
      { query: 'Metallica Enter Sandman', year: 1991 },
      { query: 'Nirvana Smells Like Teen Spirit', year: 1991 },
      { query: 'The Cure Just Like Heaven', year: 1987 },
      { query: 'Joy Division Love Will Tear Us Apart', year: 1980 },
      { query: 'Depeche Mode Personal Jesus', year: 1990 },
      { query: 'New Order Blue Monday', year: 1983 },
      { query: 'Duran Duran Hungry Like the Wolf', year: 1982 },
      { query: 'The Clash Should I Stay or Should I Go', year: 1981 },
      { query: 'Sex Pistols God Save the Queen', year: 1977 },
      { query: 'The Ramones Blitzkrieg Bop', year: 1976 },
      { query: 'Iggy Pop I Wanna Be Your Dog', year: 1969 },
      { query: 'T. Rex Bang a Gong', year: 1971 },
      { query: 'Slade Cum On Feel the Noize', year: 1973 },
      { query: 'Sweet Ballroom Blitz', year: 1973 },
      { query: 'Mott the Hoople All the Way from Memphis', year: 1973 },
      { query: 'Nazareth Love Hurts', year: 1975 },
      { query: 'Thin Lizzy The Boys Are Back in Town', year: 1976 },
      { query: 'Status Quo Rockin\' All Over the World', year: 1977 },
      { query: 'Aerosmith I Don\'t Want to Miss a Thing', year: 1998 },
      { query: 'Bon Jovi Livin\' on a Prayer', year: 1986 },
      { query: 'Def Leppard Pour Some Sugar on Me', year: 1987 },
      { query: 'Mötley Crüe Dr. Feelgood', year: 1989 },
      { query: 'Poison Every Rose Has Its Thorn', year: 1990 },
      { query: 'Cinderella Don\'t Know What You Got', year: 1988 },
      { query: 'Whitesnake Here I Go Again', year: 1982 },
      { query: 'Rainbow Since You Been Gone', year: 1979 },
      { query: 'Scorpions Rock You Like a Hurricane', year: 1984 },
      { query: 'Iron Maiden The Trooper', year: 1983 },
      { query: 'Judas Priest Breaking the Law', year: 1980 },
      { query: 'Helloween Keeper of the Seven Keys', year: 1987 },
      { query: 'Saxon Crusader', year: 1984 },
      { query: 'Motorhead Ace of Spades', year: 1980 },
      { query: 'Accept Ball and Chain', year: 1984 },
      { query: 'UFO Doctor Doctor', year: 1974 },
      { query: 'Uriah Heep Easy Livin\'', year: 1972 },
      { query: 'Humble Pie 30 Days in the Hole', year: 1974 },
      { query: 'Free All Right Now', year: 1970 },
      { query: 'Bad Company Can\'t Get Enough', year: 1974 },
      { query: 'Foreigner Cold as Ice', year: 1977 },
      { query: 'Journey Don\'t Stop Believin\'', year: 1981 },
      { query: 'Boston More Than a Feeling', year: 1976 },
      { query: 'Kansas Carry On Wayward Son', year: 1976 },
      { query: 'Styx Renegade', year: 1978 },
      { query: 'Yes Owner of a Lonely Heart', year: 1983 },
      { query: 'Genesis In the Air Tonight', year: 1981 },
      { query: 'Emerson Lake Palmer Karn Evil 9', year: 1973 },
      { query: 'Jethro Tull Aqualung', year: 1971 },
      { query: 'King Crimson 21st Century Schizoid Man', year: 1969 },
      { query: 'Procol Harum A Whiter Shade of Pale', year: 1967 },
      { query: 'Curved Air Airconditioning', year: 1970 },
      { query: 'Roxy Music Virginia Plain', year: 1972 },
      { query: 'Mott the Hoople All the Young Dudes', year: 1972 },
      { query: 'Sickagain Cum On Feel the Noize', year: 1973 },
      { query: 'Soft Machine Facelift', year: 1970 },
      { query: 'Gong Flying Teapot', year: 1973 },
      { query: 'Frank Zappa Don\'t Eat the Yellow Snow', year: 1974 },
      { query: 'Captain Beefheart Trout Mask Replica', year: 1969 },
      { query: 'Robert Fripp Exposure', year: 1979 },
      { query: 'David Byrne Rei Momo', year: 1989 },
      { query: 'Sting Fields of Gold', year: 1993 },
      { query: 'Peter Frampton Do You Feel Like We Do', year: 1975 },
      { query: 'Nazareth Hair of the Dog', year: 1975 },
      { query: 'Foghat Slow Ride', year: 1975 },
      { query: 'Mountain Mississippi Queen', year: 1970 },
      { query: 'Blue Öyster Cult (Don\'t Fear) The Reaper', year: 1976 },
      { query: 'Santana Evil Ways', year: 1969 },
      { query: 'War Low Rider', year: 1975 },
      { query: 'Earth Wind Fire September', year: 1978 },
      { query: 'Chic Le Freak', year: 1978 },
      { query: 'Bee Gees Night Fever', year: 1977 },
      { query: 'Donna Summer Hot Stuff', year: 1979 },
      { query: 'Gloria Gaynor I Will Survive', year: 1978 },
      { query: 'Village People YMCA', year: 1978 },
      { query: 'KC and the Sunshine Band That\'s the Way', year: 1975 },
      { query: 'The Isley Brothers Footsteps in the Dark', year: 1977 },
      { query: 'Marvin Gaye Got to Give It Up', year: 1977 },
      { query: 'Stevie Wonder Superstition', year: 1972 },
      { query: 'Michael Jackson Billie Jean', year: 1983 },
      { query: 'Prince When Doves Cry', year: 1984 },
      { query: 'Madonna Like a Virgin', year: 1984 },
      { query: 'David Bowie Let\'s Dance', year: 1983 },
      { query: 'Blondie Call Me', year: 1980 },
      { query: 'Talking Heads Once in a Lifetime', year: 1981 },
      { query: 'The B-52\'s Rock Lobster', year: 1978 },
    ];

    const questions = [];

    for (const { query, year } of songs) {
      const searchRes = await fetch(
        `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=1`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        }
      );

      const searchData = await searchRes.json();
      const track = searchData.tracks?.items?.[0];

      if (track && track.preview_url) {
        questions.push({
          question: `Bu şarkıyı tanıyor musun? "${track.name}" - ${track.artists?.[0]?.name || 'Unknown'}`,
          year: year,
          category: 'muzik',
          type: 'muzik',
          media_url: track.preview_url,
          artist: track.artists?.[0]?.name || 'Unknown',
        });
      }

      // Rate limit to avoid hitting Spotify API limits
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    // Create questions in batches
    const created = await base44.entities.Question.bulkCreate(questions);

    return Response.json({
      success: true,
      created: created.length,
      total: questions.length,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});