import { useState, useCallback, useRef, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

// Track in-flight generation requests by question ID to prevent duplicates
const generationInFlight = new Map();

export function useQuestionMedia(question) {
  const [mediaUrl, setMediaUrl] = useState(question?.media_url || null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState(null);
  const generatedRef = useRef(false);

  // Slugify question text for asset naming
  const slugifyQuestion = useCallback((text) => {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9çğıöşü]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .substring(0, 50);
  }, []);

  const generateMedia = useCallback(async () => {
    // Exit if already has media or is generating
    if (mediaUrl || isGenerating || !question?.id) return;
    if (generatedRef.current) return;
    generatedRef.current = true;

    // Check if generation is already in flight for this question
    if (generationInFlight.has(question.id)) {
      // Wait for the in-flight request
      return generationInFlight.get(question.id);
    }

    setIsGenerating(true);
    setError(null);

    try {
      // Create the generation promise
      const generationPromise = (async () => {
        // Build the category-specific style hint
        const categoryHints = {
          teknoloji: 'Use nostalgic devices, glowing screens, early internet atmosphere, futuristic UI light, digital particles, neon reflections.',
          muzik: 'Use concert lighting, silhouettes, stage energy, sound waves, neon rhythm, emotionally charged atmosphere.',
          sanat: 'Use cinematic film/TV atmosphere, dramatic lighting, iconic mood, stage/set feeling, emotional composition.',
          spor: 'Use stadium lights, dramatic action energy, crowd glow, trophy atmosphere, motion blur, competitive tension.',
          bilim: 'Use space, laboratory, discovery, cosmic lighting, scientific glow, awe and wonder.',
          tarih: 'Use cinematic historical atmosphere, symbolic objects, dramatic light, epic but clean composition.',
          karisik: 'Use visually evocative, cinematic atmosphere matching the event\'s era or energy.',
        };

        const categoryHint = categoryHints[question.category] || categoryHints.karisik;

        const prompt = `Create a premium cinematic visual for a mobile timeline party game question card.

Question/event:
"${question.question}"

Category:
"${question.category || 'genel'}"

Difficulty:
${question.difficulty || 1}/3

Visual direction:
Create a highly polished, premium game-card background image that visually represents the event. The main subject should be concentrated in the center of the image. The edges must softly dissolve into a dark purple / deep navy gradient so the image blends naturally with the Kronox card background.

Style:
Premium neon arcade, cinematic lighting, modern mobile game card art, dark purple and deep navy base, subtle neon yellow accents, atmospheric glow, high contrast, soft depth, polished composition, emotionally engaging, nostalgic when relevant.

Category-specific hint:
${categoryHint}

Composition:
Portrait card-friendly composition (3:4 aspect ratio), centered subject, clean readable lower area for UI text overlay, soft vignette, edge fade, no clutter, no harsh borders.

Do NOT include:
No large readable text, no logos, no watermark, no UI chrome, no app screenshots, no cheap clipart, no cartoonish style, no low-quality stock photo look, no writing on the image.

Output should feel like:
A premium collectible card background for Kronox.`;

        // Generate image using InvokeLLM
        const { url: generatedUrl } = await base44.integrations.Core.GenerateImage({
          prompt,
        });

        if (!generatedUrl) throw new Error('No image URL returned');

        // Upload the generated image to persistent storage
        const slug = slugifyQuestion(question.question);
        const filename = `q_${question.id}_${slug}.webp`;

        // Download the generated image and upload it
        const imageBlob = await fetch(generatedUrl).then(r => r.blob());
        const uploadedFile = new FormData();
        uploadedFile.append('file', new File([imageBlob], filename, { type: 'image/webp' }));

        const { file_url } = await base44.integrations.Core.UploadFile({
          file: imageBlob,
        });

        if (!file_url) throw new Error('Failed to upload image');

        // Update the question entity with the new media_url
        await base44.entities.Question.update(question.id, {
          media_url: file_url,
        });

        setMediaUrl(file_url);
        return file_url;
      })();

      // Store the promise in the in-flight map
      generationInFlight.set(question.id, generationPromise);

      await generationPromise;
    } catch (err) {
      console.error('Failed to generate question media:', err);
      setError(err.message);
      generatedRef.current = false; // Allow retry on error
    } finally {
      setIsGenerating(false);
      generationInFlight.delete(question.id);
    }
  }, [question, mediaUrl, isGenerating, slugifyQuestion]);

  // Trigger generation when component mounts if needed
  useEffect(() => {
    if (!mediaUrl && question?.id && !isGenerating) {
      generateMedia();
    }
  }, [question?.id, mediaUrl, isGenerating, generateMedia]);

  return {
    mediaUrl,
    isGenerating,
    error,
    retry: generateMedia,
  };
}