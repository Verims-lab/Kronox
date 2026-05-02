import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Deezer API - no auth needed for search endpoint (server-side)
// Returns tracks with 30-second preview URLs for free

const songs = [
  { query: 'The Beatles Hey Jude', year: 1968 },
  { query: 'Pink Floyd Comfortably Numb', year: 1979 },
  { query: 'Led Zeppelin Stairway to Heaven', year: 1971 },
  { query: 'Queen Bohemian Rhapsody', year: 1975 },
  { query: 'David Bowie Space Oddity', year: 1969 },
  { query: 'The Rolling Stones Sympathy for the Devil', year: 1968 },
  { query: 'Jimi Hendrix Purple Haze', year: 1967 },
  { query: 'AC/DC Back in Black', year: 1980 },
  { query: 'Guns N Roses Sweet Child o Mine', year: 1988 },
  { query: 'Metallica Enter Sandman', year: 1991 },
  { query: 'Nirvana Smells Like Teen Spirit', year: 1991 },
  { query: 'Depeche Mode Personal Jesus', year: 1990 },
  { query: 'New Order Blue Monday', year: 1983 },
  { query: 'The Clash Should I Stay or Should I Go', year: 1982 },
  { query: 'Sex Pistols God Save the Queen', year: 1977 },
  { query: 'Bon Jovi Livin on a Prayer', year: 1986 },
  { query: 'Def Leppard Pour Some Sugar on Me', year: 1987 },
  { query: 'Whitesnake Here I Go Again', year: 1987 },
  { query: 'Scorpions Rock You Like a Hurricane', year: 1984 },
  { query: 'Iron Maiden The Trooper', year: 1983 },
  { query: 'Judas Priest Breaking the Law', year: 1980 },
  { query: 'Motorhead Ace of Spades', year: 1980 },
  { query: 'Journey Don\'t Stop Believin', year: 1981 },
  { query: 'Boston More Than a Feeling', year: 1976 },
  { query: 'Aerosmith I Don\'t Want to Miss a Thing', year: 1998 },
  { query: 'Michael Jackson Billie Jean', year: 1983 },
  { query: 'Prince When Doves Cry', year: 1984 },
  { query: 'Madonna Like a Virgin', year: 1984 },
  { query: 'David Bowie Let\'s Dance', year: 1983 },
  { query: 'Blondie Call Me', year: 1980 },
  { query: 'Talking Heads Once in a Lifetime', year: 1981 },
  { query: 'Earth Wind Fire September', year: 1978 },
  { query: 'Bee Gees Night Fever', year: 1977 },
  { query: 'Donna Summer Hot Stuff', year: 1979 },
  { query: 'Gloria Gaynor I Will Survive', year: 1978 },
  { query: 'Stevie Wonder Superstition', year: 1972 },
  { query: 'Marvin Gaye Got to Give It Up', year: 1977 },
  { query: 'Black Sabbath Iron Man', year: 1972 },
  { query: 'Deep Purple Smoke on the Water', year: 1971 },
  { query: 'Free All Right Now', year: 1970 },
  { query: 'Thin Lizzy The Boys Are Back in Town', year: 1976 },
  { query: 'Foreigner Cold as Ice', year: 1977 },
  { query: 'Kansas Carry On Wayward Son', year: 1976 },
  { query: 'The Who My Generation', year: 1965 },
  { query: 'Duran Duran Hungry Like the Wolf', year: 1982 },
  { query: 'Santana Evil Ways', year: 1969 },
  { query: 'Procol Harum A Whiter Shade of Pale', year: 1967 },
  { query: 'Nazareth Love Hurts', year: 1975 },
  { query: 'Blue Oyster Cult Don\'t Fear The Reaper', year: 1976 },
  { query: 'Creedence Clearwater Revival Fortunate Son', year: 1969 },
  { query: 'The Doors Riders on the Storm', year: 1971 },
  { query: 'Fleetwood Mac Go Your Own Way', year: 1977 },
  { query: 'Eagles Hotel California', year: 1977 },
  { query: 'Lynyrd Skynyrd Sweet Home Alabama', year: 1974 },
  { query: 'ZZ Top Sharp Dressed Man', year: 1983 },
  { query: 'Van Halen Jump', year: 1984 },
  { query: 'Ozzy Osbourne Crazy Train', year: 1980 },
  { query: 'Dio Holy Diver', year: 1983 },
  { query: 'Radiohead Creep', year: 1992 },
  { query: 'Pearl Jam Alive', year: 1991 },
  { query: 'Soundgarden Black Hole Sun', year: 1994 },
  { query: 'Alice in Chains Would', year: 1992 },
  { query: 'Red Hot Chili Peppers Under the Bridge', year: 1992 },
  { query: 'Green Day Basket Case', year: 1994 },
  { query: 'Foo Fighters Everlong', year: 1997 },
  { query: 'Oasis Wonderwall', year: 1995 },
  { query: 'The Verve Bitter Sweet Symphony', year: 1997 },
  { query: 'Blur Song 2', year: 1997 },
  { query: 'Smashing Pumpkins Bullet With Butterfly Wings', year: 1995 },
  { query: 'Beck Loser', year: 1993 },
  { query: 'Alanis Morissette Ironic', year: 1995 },
  { query: 'No Doubt Don\'t Speak', year: 1996 },
  { query: 'TLC Waterfalls', year: 1995 },
  { query: 'Destiny\'s Child Say My Name', year: 1999 },
  { query: 'Eminem Lose Yourself', year: 2002 },
  { query: 'Jay-Z 99 Problems', year: 2003 },
  { query: 'Outkast Hey Ya', year: 2003 },
  { query: 'Nelly Hot in Herre', year: 2002 },
  { query: 'Missy Elliott Get Ur Freak On', year: 2001 },
  { query: 'Amy Winehouse Rehab', year: 2006 },
  { query: 'Adele Rolling in the Deep', year: 2010 },
  { query: 'Coldplay The Scientist', year: 2002 },
  { query: 'Muse Uprising', year: 2009 },
  { query: 'Arctic Monkeys R U Mine', year: 2013 },
  { query: 'Daft Punk Get Lucky', year: 2013 },
  { query: 'Pharrell Williams Happy', year: 2013 },
  { query: 'Bruno Mars Uptown Funk', year: 2014 },
  { query: 'Ed Sheeran Shape of You', year: 2017 },
  { query: 'Billie Eilish Bad Guy', year: 2019 },
  { query: 'The Weeknd Blinding Lights', year: 2019 },
  { query: 'Post Malone Rockstar', year: 2017 },
  { query: 'Drake God\'s Plan', year: 2018 },
  { query: 'Kendrick Lamar HUMBLE', year: 2017 },
  { query: 'Beyonce Crazy in Love', year: 2003 },
  { query: 'Rihanna Umbrella', year: 2007 },
  { query: 'Lady Gaga Bad Romance', year: 2009 },
  { query: 'Katy Perry Roar', year: 2013 },
  { query: 'Taylor Swift Shake It Off', year: 2014 },
];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const questions = [];
    const errors = [];

    for (const { query, year } of songs) {
      const url = `https://api.deezer.com/search?q=${encodeURIComponent(query)}&limit=1`;
      const res = await fetch(url, {
        headers: { 'Accept': 'application/json' }
      });

      if (!res.ok) {
        errors.push(`${query}: HTTP ${res.status}`);
        await new Promise(r => setTimeout(r, 300));
        continue;
      }

      const data = await res.json();
      const track = data?.data?.[0];

      if (track && track.preview) {
        questions.push({
          question: `Bu şarkıyı tanıyor musun? "${track.title_short}" - ${track.artist?.name}`,
          year: year,
          category: 'muzik',
          type: 'muzik',
          media_url: track.preview,
        });
      } else {
        errors.push(`${query}: preview yok`);
      }

      // Rate limit — be polite to Deezer
      await new Promise(r => setTimeout(r, 150));
    }

    if (questions.length === 0) {
      return Response.json({ success: false, message: 'Deezer\'dan hiç preview alınamadı', errors });
    }

    // Delete old music questions first, then bulk insert fresh ones
    const existing = await base44.asServiceRole.entities.Question.filter({ type: 'muzik' });
    for (const q of existing) {
      await base44.asServiceRole.entities.Question.delete(q.id);
    }

    const created = await base44.asServiceRole.entities.Question.bulkCreate(questions);

    return Response.json({
      success: true,
      created: created.length,
      total: songs.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});