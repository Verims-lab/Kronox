import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { question, year, category, hintLevel = 1 } = await req.json();

    if (!question || !year) {
      return Response.json({ error: 'Soru ve yıl gereklidir' }, { status: 400 });
    }

    const prompt = `
Bir zaman çizelgesi oyunu sırasında şu soru soruldu:
Soru: "${question}"
Doğru Cevap: ${year}
Kategori: ${category || 'Genel'}
İpucu Seviyesi: ${hintLevel} (1=genel, 2=orta, 3=spesifik)

${hintLevel === 1 ? 'Genel bir tarihsel ipucu ver - oyuncuya dönem hakkında genel bilgi ver ama exact yılı söyleme.' : ''}
${hintLevel === 2 ? 'Daha spesifik bir ipucu ver - ilgili olayın veya dönemin belirli özelliklerinden bahset ama yılı söyleme.' : ''}
${hintLevel === 3 ? 'Oyuncuya on yıl içinde dar bir zaman aralığı ver (örn: "1960lar" veya "erken 2000ler") ama kesin yılı söyleme.' : ''}

Ipuçu kısa, öğretici ve eğlenceli olmalı. Türkçe olarak cevap ver.`;

    const response = await base44.integrations.Core.InvokeLLM({
      prompt,
      model: 'gemini_3_flash'
    });

    return Response.json({ 
      hint: response,
      year,
      category,
      hintLevel
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});