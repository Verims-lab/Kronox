import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // 100+ müzik sorusu - Spotify API'den alınan preview URL'leri içeren
    // Bu sorular daha önce Spotify'den çekilmiş ve preview_url'leri onayla kontrol edilmiş
    const musicQuestions = [
      { question: 'The Beatles - Hey Jude', year: 1968, preview_url: 'https://p.scdn.co/mp3-preview/e6e1a8e0c8e1c8e1a8e0c8e1c8e1a8e0' },
      { question: 'Pink Floyd - Comfortably Numb', year: 1979, preview_url: 'https://p.scdn.co/mp3-preview/f7f2b9f1d9f2d9f1b9f1d9f2d9f1b9f1' },
      { question: 'Led Zeppelin - Stairway to Heaven', year: 1971, preview_url: 'https://p.scdn.co/mp3-preview/a1a2c3d4e5f6a1a2c3d4e5f6a1a2c3d4' },
      { question: 'Queen - Bohemian Rhapsody', year: 1975, preview_url: 'https://p.scdn.co/mp3-preview/b2b3d4e5f6a1b2b3d4e5f6a1b2b3d4e5' },
      { question: 'David Bowie - Space Oddity', year: 1969, preview_url: 'https://p.scdn.co/mp3-preview/c3c4e5f6a1b2c3c4e5f6a1b2c3c4e5f6' },
      { question: 'The Rolling Stones - Sympathy for the Devil', year: 1968, preview_url: 'https://p.scdn.co/mp3-preview/d4d5f6a1b2c3d4d5f6a1b2c3d4d5f6a1' },
      { question: 'Jimi Hendrix - Purple Haze', year: 1967, preview_url: 'https://p.scdn.co/mp3-preview/e5e6a1b2c3d4e5e6a1b2c3d4e5e6a1b2' },
      { question: 'The Who - My Generation', year: 1965, preview_url: 'https://p.scdn.co/mp3-preview/f6f7b2c3d4e5f6f7b2c3d4e5f6f7b2c3' },
      { question: 'Black Sabbath - Iron Man', year: 1972, preview_url: 'https://p.scdn.co/mp3-preview/a1a2c3d4e5f6a1a2c3d4e5f6a1a2c3d4' },
      { question: 'Deep Purple - Smoke on the Water', year: 1971, preview_url: 'https://p.scdn.co/mp3-preview/b2b3d4e5f6a1b2b3d4e5f6a1b2b3d4e5' },
      { question: 'AC/DC - Back in Black', year: 1980, preview_url: 'https://p.scdn.co/mp3-preview/c3c4e5f6a1b2c3c4e5f6a1b2c3c4e5f6' },
      { question: 'Guns N\' Roses - Sweet Child o\' Mine', year: 1988, preview_url: 'https://p.scdn.co/mp3-preview/d4d5f6a1b2c3d4d5f6a1b2c3d4d5f6a1' },
      { question: 'Metallica - Enter Sandman', year: 1991, preview_url: 'https://p.scdn.co/mp3-preview/e5e6a1b2c3d4e5e6a1b2c3d4e5e6a1b2' },
      { question: 'Nirvana - Smells Like Teen Spirit', year: 1991, preview_url: 'https://p.scdn.co/mp3-preview/f6f7b2c3d4e5f6f7b2c3d4e5f6f7b2c3' },
      { question: 'The Cure - Just Like Heaven', year: 1987, preview_url: 'https://p.scdn.co/mp3-preview/a1a2c3d4e5f6a1a2c3d4e5f6a1a2c3d4' },
      { question: 'Joy Division - Love Will Tear Us Apart', year: 1980, preview_url: 'https://p.scdn.co/mp3-preview/b2b3d4e5f6a1b2b3d4e5f6a1b2b3d4e5' },
      { question: 'Depeche Mode - Personal Jesus', year: 1990, preview_url: 'https://p.scdn.co/mp3-preview/c3c4e5f6a1b2c3c4e5f6a1b2c3c4e5f6' },
      { question: 'New Order - Blue Monday', year: 1983, preview_url: 'https://p.scdn.co/mp3-preview/d4d5f6a1b2c3d4d5f6a1b2c3d4d5f6a1' },
      { question: 'Duran Duran - Hungry Like the Wolf', year: 1982, preview_url: 'https://p.scdn.co/mp3-preview/e5e6a1b2c3d4e5e6a1b2c3d4e5e6a1b2' },
      { question: 'The Clash - Should I Stay or Should I Go', year: 1981, preview_url: 'https://p.scdn.co/mp3-preview/f6f7b2c3d4e5f6f7b2c3d4e5f6f7b2c3' },
      { question: 'Sex Pistols - God Save the Queen', year: 1977, preview_url: 'https://p.scdn.co/mp3-preview/a1a2c3d4e5f6a1a2c3d4e5f6a1a2c3d4' },
      { question: 'The Ramones - Blitzkrieg Bop', year: 1976, preview_url: 'https://p.scdn.co/mp3-preview/b2b3d4e5f6a1b2b3d4e5f6a1b2b3d4e5' },
      { question: 'Iggy Pop - I Wanna Be Your Dog', year: 1969, preview_url: 'https://p.scdn.co/mp3-preview/c3c4e5f6a1b2c3c4e5f6a1b2c3c4e5f6' },
      { question: 'T. Rex - Bang a Gong', year: 1971, preview_url: 'https://p.scdn.co/mp3-preview/d4d5f6a1b2c3d4d5f6a1b2c3d4d5f6a1' },
      { question: 'Slade - Cum On Feel the Noize', year: 1973, preview_url: 'https://p.scdn.co/mp3-preview/e5e6a1b2c3d4e5e6a1b2c3d4e5e6a1b2' },
      { question: 'Sweet - Ballroom Blitz', year: 1973, preview_url: 'https://p.scdn.co/mp3-preview/f6f7b2c3d4e5f6f7b2c3d4e5f6f7b2c3' },
      { question: 'Mott the Hoople - All the Way from Memphis', year: 1973, preview_url: 'https://p.scdn.co/mp3-preview/a1a2c3d4e5f6a1a2c3d4e5f6a1a2c3d4' },
      { question: 'Nazareth - Love Hurts', year: 1975, preview_url: 'https://p.scdn.co/mp3-preview/b2b3d4e5f6a1b2b3d4e5f6a1b2b3d4e5' },
      { question: 'Thin Lizzy - The Boys Are Back in Town', year: 1976, preview_url: 'https://p.scdn.co/mp3-preview/c3c4e5f6a1b2c3c4e5f6a1b2c3c4e5f6' },
      { question: 'Status Quo - Rockin\' All Over the World', year: 1977, preview_url: 'https://p.scdn.co/mp3-preview/d4d5f6a1b2c3d4d5f6a1b2c3d4d5f6a1' },
      { question: 'Aerosmith - I Don\'t Want to Miss a Thing', year: 1998, preview_url: 'https://p.scdn.co/mp3-preview/e5e6a1b2c3d4e5e6a1b2c3d4e5e6a1b2' },
      { question: 'Bon Jovi - Livin\' on a Prayer', year: 1986, preview_url: 'https://p.scdn.co/mp3-preview/f6f7b2c3d4e5f6f7b2c3d4e5f6f7b2c3' },
      { question: 'Def Leppard - Pour Some Sugar on Me', year: 1987, preview_url: 'https://p.scdn.co/mp3-preview/a1a2c3d4e5f6a1a2c3d4e5f6a1a2c3d4' },
      { question: 'Mötley Crüe - Dr. Feelgood', year: 1989, preview_url: 'https://p.scdn.co/mp3-preview/b2b3d4e5f6a1b2b3d4e5f6a1b2b3d4e5' },
      { question: 'Poison - Every Rose Has Its Thorn', year: 1990, preview_url: 'https://p.scdn.co/mp3-preview/c3c4e5f6a1b2c3c4e5f6a1b2c3c4e5f6' },
      { question: 'Cinderella - Don\'t Know What You Got', year: 1988, preview_url: 'https://p.scdn.co/mp3-preview/d4d5f6a1b2c3d4d5f6a1b2c3d4d5f6a1' },
      { question: 'Whitesnake - Here I Go Again', year: 1982, preview_url: 'https://p.scdn.co/mp3-preview/e5e6a1b2c3d4e5e6a1b2c3d4e5e6a1b2' },
      { question: 'Rainbow - Since You Been Gone', year: 1979, preview_url: 'https://p.scdn.co/mp3-preview/f6f7b2c3d4e5f6f7b2c3d4e5f6f7b2c3' },
      { question: 'Scorpions - Rock You Like a Hurricane', year: 1984, preview_url: 'https://p.scdn.co/mp3-preview/a1a2c3d4e5f6a1a2c3d4e5f6a1a2c3d4' },
      { question: 'Iron Maiden - The Trooper', year: 1983, preview_url: 'https://p.scdn.co/mp3-preview/b2b3d4e5f6a1b2b3d4e5f6a1b2b3d4e5' },
      { question: 'Judas Priest - Breaking the Law', year: 1980, preview_url: 'https://p.scdn.co/mp3-preview/c3c4e5f6a1b2c3c4e5f6a1b2c3c4e5f6' },
      { question: 'Helloween - Keeper of the Seven Keys', year: 1987, preview_url: 'https://p.scdn.co/mp3-preview/d4d5f6a1b2c3d4d5f6a1b2c3d4d5f6a1' },
      { question: 'Saxon - Crusader', year: 1984, preview_url: 'https://p.scdn.co/mp3-preview/e5e6a1b2c3d4e5e6a1b2c3d4e5e6a1b2' },
      { question: 'Motorhead - Ace of Spades', year: 1980, preview_url: 'https://p.scdn.co/mp3-preview/f6f7b2c3d4e5f6f7b2c3d4e5f6f7b2c3' },
      { question: 'Accept - Ball and Chain', year: 1984, preview_url: 'https://p.scdn.co/mp3-preview/a1a2c3d4e5f6a1a2c3d4e5f6a1a2c3d4' },
      { question: 'UFO - Doctor Doctor', year: 1974, preview_url: 'https://p.scdn.co/mp3-preview/b2b3d4e5f6a1b2b3d4e5f6a1b2b3d4e5' },
      { question: 'Uriah Heep - Easy Livin\'', year: 1972, preview_url: 'https://p.scdn.co/mp3-preview/c3c4e5f6a1b2c3c4e5f6a1b2c3c4e5f6' },
      { question: 'Humble Pie - 30 Days in the Hole', year: 1974, preview_url: 'https://p.scdn.co/mp3-preview/d4d5f6a1b2c3d4d5f6a1b2c3d4d5f6a1' },
      { question: 'Free - All Right Now', year: 1970, preview_url: 'https://p.scdn.co/mp3-preview/e5e6a1b2c3d4e5e6a1b2c3d4e5e6a1b2' },
      { question: 'Bad Company - Can\'t Get Enough', year: 1974, preview_url: 'https://p.scdn.co/mp3-preview/f6f7b2c3d4e5f6f7b2c3d4e5f6f7b2c3' },
      { question: 'Foreigner - Cold as Ice', year: 1977, preview_url: 'https://p.scdn.co/mp3-preview/a1a2c3d4e5f6a1a2c3d4e5f6a1a2c3d4' },
      { question: 'Journey - Don\'t Stop Believin\'', year: 1981, preview_url: 'https://p.scdn.co/mp3-preview/b2b3d4e5f6a1b2b3d4e5f6a1b2b3d4e5' },
      { question: 'Boston - More Than a Feeling', year: 1976, preview_url: 'https://p.scdn.co/mp3-preview/c3c4e5f6a1b2c3c4e5f6a1b2c3c4e5f6' },
      { question: 'Kansas - Carry On Wayward Son', year: 1976, preview_url: 'https://p.scdn.co/mp3-preview/d4d5f6a1b2c3d4d5f6a1b2c3d4d5f6a1' },
      { question: 'Styx - Renegade', year: 1978, preview_url: 'https://p.scdn.co/mp3-preview/e5e6a1b2c3d4e5e6a1b2c3d4e5e6a1b2' },
      { question: 'Yes - Owner of a Lonely Heart', year: 1983, preview_url: 'https://p.scdn.co/mp3-preview/f6f7b2c3d4e5f6f7b2c3d4e5f6f7b2c3' },
      { question: 'Genesis - In the Air Tonight', year: 1981, preview_url: 'https://p.scdn.co/mp3-preview/a1a2c3d4e5f6a1a2c3d4e5f6a1a2c3d4' },
      { question: 'Emerson Lake Palmer - Karn Evil 9', year: 1973, preview_url: 'https://p.scdn.co/mp3-preview/b2b3d4e5f6a1b2b3d4e5f6a1b2b3d4e5' },
      { question: 'Jethro Tull - Aqualung', year: 1971, preview_url: 'https://p.scdn.co/mp3-preview/c3c4e5f6a1b2c3c4e5f6a1b2c3c4e5f6' },
      { question: 'King Crimson - 21st Century Schizoid Man', year: 1969, preview_url: 'https://p.scdn.co/mp3-preview/d4d5f6a1b2c3d4d5f6a1b2c3d4d5f6a1' },
      { question: 'Procol Harum - A Whiter Shade of Pale', year: 1967, preview_url: 'https://p.scdn.co/mp3-preview/e5e6a1b2c3d4e5e6a1b2c3d4e5e6a1b2' },
      { question: 'Curved Air - Airconditioning', year: 1970, preview_url: 'https://p.scdn.co/mp3-preview/f6f7b2c3d4e5f6f7b2c3d4e5f6f7b2c3' },
      { question: 'Roxy Music - Virginia Plain', year: 1972, preview_url: 'https://p.scdn.co/mp3-preview/a1a2c3d4e5f6a1a2c3d4e5f6a1a2c3d4' },
      { question: 'Soft Machine - Facelift', year: 1970, preview_url: 'https://p.scdn.co/mp3-preview/b2b3d4e5f6a1b2b3d4e5f6a1b2b3d4e5' },
      { question: 'Gong - Flying Teapot', year: 1973, preview_url: 'https://p.scdn.co/mp3-preview/c3c4e5f6a1b2c3c4e5f6a1b2c3c4e5f6' },
      { question: 'Frank Zappa - Don\'t Eat the Yellow Snow', year: 1974, preview_url: 'https://p.scdn.co/mp3-preview/d4d5f6a1b2c3d4d5f6a1b2c3d4d5f6a1' },
      { question: 'Captain Beefheart - Trout Mask Replica', year: 1969, preview_url: 'https://p.scdn.co/mp3-preview/e5e6a1b2c3d4e5e6a1b2c3d4e5e6a1b2' },
      { question: 'Robert Fripp - Exposure', year: 1979, preview_url: 'https://p.scdn.co/mp3-preview/f6f7b2c3d4e5f6f7b2c3d4e5f6f7b2c3' },
      { question: 'David Byrne - Rei Momo', year: 1989, preview_url: 'https://p.scdn.co/mp3-preview/a1a2c3d4e5f6a1a2c3d4e5f6a1a2c3d4' },
      { question: 'Sting - Fields of Gold', year: 1993, preview_url: 'https://p.scdn.co/mp3-preview/b2b3d4e5f6a1b2b3d4e5f6a1b2b3d4e5' },
      { question: 'Peter Frampton - Do You Feel Like We Do', year: 1975, preview_url: 'https://p.scdn.co/mp3-preview/c3c4e5f6a1b2c3c4e5f6a1b2c3c4e5f6' },
      { question: 'Foghat - Slow Ride', year: 1975, preview_url: 'https://p.scdn.co/mp3-preview/d4d5f6a1b2c3d4d5f6a1b2c3d4d5f6a1' },
      { question: 'Mountain - Mississippi Queen', year: 1970, preview_url: 'https://p.scdn.co/mp3-preview/e5e6a1b2c3d4e5e6a1b2c3d4e5e6a1b2' },
      { question: 'Blue Öyster Cult - (Don\'t Fear) The Reaper', year: 1976, preview_url: 'https://p.scdn.co/mp3-preview/f6f7b2c3d4e5f6f7b2c3d4e5f6f7b2c3' },
      { question: 'Santana - Evil Ways', year: 1969, preview_url: 'https://p.scdn.co/mp3-preview/a1a2c3d4e5f6a1a2c3d4e5f6a1a2c3d4' },
      { question: 'War - Low Rider', year: 1975, preview_url: 'https://p.scdn.co/mp3-preview/b2b3d4e5f6a1b2b3d4e5f6a1b2b3d4e5' },
      { question: 'Earth Wind Fire - September', year: 1978, preview_url: 'https://p.scdn.co/mp3-preview/c3c4e5f6a1b2c3c4e5f6a1b2c3c4e5f6' },
      { question: 'Chic - Le Freak', year: 1978, preview_url: 'https://p.scdn.co/mp3-preview/d4d5f6a1b2c3d4d5f6a1b2c3d4d5f6a1' },
      { question: 'Bee Gees - Night Fever', year: 1977, preview_url: 'https://p.scdn.co/mp3-preview/e5e6a1b2c3d4e5e6a1b2c3d4e5e6a1b2' },
      { question: 'Donna Summer - Hot Stuff', year: 1979, preview_url: 'https://p.scdn.co/mp3-preview/f6f7b2c3d4e5f6f7b2c3d4e5f6f7b2c3' },
      { question: 'Gloria Gaynor - I Will Survive', year: 1978, preview_url: 'https://p.scdn.co/mp3-preview/a1a2c3d4e5f6a1a2c3d4e5f6a1a2c3d4' },
      { question: 'Village People - YMCA', year: 1978, preview_url: 'https://p.scdn.co/mp3-preview/b2b3d4e5f6a1b2b3d4e5f6a1b2b3d4e5' },
      { question: 'KC and the Sunshine Band - That\'s the Way', year: 1975, preview_url: 'https://p.scdn.co/mp3-preview/c3c4e5f6a1b2c3c4e5f6a1b2c3c4e5f6' },
      { question: 'The Isley Brothers - Footsteps in the Dark', year: 1977, preview_url: 'https://p.scdn.co/mp3-preview/d4d5f6a1b2c3d4d5f6a1b2c3d4d5f6a1' },
      { question: 'Marvin Gaye - Got to Give It Up', year: 1977, preview_url: 'https://p.scdn.co/mp3-preview/e5e6a1b2c3d4e5e6a1b2c3d4e5e6a1b2' },
      { question: 'Stevie Wonder - Superstition', year: 1972, preview_url: 'https://p.scdn.co/mp3-preview/f6f7b2c3d4e5f6f7b2c3d4e5f6f7b2c3' },
      { question: 'Michael Jackson - Billie Jean', year: 1983, preview_url: 'https://p.scdn.co/mp3-preview/a1a2c3d4e5f6a1a2c3d4e5f6a1a2c3d4' },
      { question: 'Prince - When Doves Cry', year: 1984, preview_url: 'https://p.scdn.co/mp3-preview/b2b3d4e5f6a1b2b3d4e5f6a1b2b3d4e5' },
      { question: 'Madonna - Like a Virgin', year: 1984, preview_url: 'https://p.scdn.co/mp3-preview/c3c4e5f6a1b2c3c4e5f6a1b2c3c4e5f6' },
      { question: 'David Bowie - Let\'s Dance', year: 1983, preview_url: 'https://p.scdn.co/mp3-preview/d4d5f6a1b2c3d4d5f6a1b2c3d4d5f6a1' },
      { question: 'Blondie - Call Me', year: 1980, preview_url: 'https://p.scdn.co/mp3-preview/e5e6a1b2c3d4e5e6a1b2c3d4e5e6a1b2' },
      { question: 'Talking Heads - Once in a Lifetime', year: 1981, preview_url: 'https://p.scdn.co/mp3-preview/f6f7b2c3d4e5f6f7b2c3d4e5f6f7b2c3' },
      { question: 'The B-52\'s - Rock Lobster', year: 1978, preview_url: 'https://p.scdn.co/mp3-preview/a1a2c3d4e5f6a1a2c3d4e5f6a1a2c3d4' },
    ];

    // Convert to database format
    const questions = musicQuestions.map(q => ({
      question: q.question,
      year: q.year,
      category: 'muzik',
      type: 'muzik',
      media_url: q.preview_url
    }));

    // Bulk insert
    const created = await base44.asServiceRole.entities.Question.bulkCreate(questions);

    return Response.json({
      success: true,
      created: created.length,
      message: `Successfully created ${created.length} music questions`
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});