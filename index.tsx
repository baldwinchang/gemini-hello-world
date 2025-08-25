import {
  GoogleGenAI,
} from '@google/genai';

import { renderLineBreaks, renderLine } from './parser.tsx';

const RENDER_RICH_AND_PLAIN = false;

async function main(prompt: string) {
  const responseContainer = document.getElementById('response-container');
  const sourcesContainer = document.getElementById('sources-container');

  if (!responseContainer || !sourcesContainer) {
    console.error('Required DOM elements not found.');
    return;
  }

  responseContainer.textContent = 'Thinking...';
  sourcesContainer.innerHTML = '';

  try {
    const ai = new GoogleGenAI({
      apiKey: process.env.API_KEY,
    });

    const config = {
      tools: [{ googleSearch: {} }],
      systemInstruction: [
        {
          text: `Input text shall be used as a search key. Search key should utilize and respond with the most useful, concise, accurate, and understandable context possible. If the response has low confidence in qualities such as comprehension, logic, or inability to provide coherent and cohesive should be replaced with a confident and level attitude that the information presented is noteworthy in its lack of quality.

The response should attempt to be within one paragraph, less than four sentences. The intent behind where the response is rendered is as a response to a highlight or curious query from a user's phone interface.

If the search term represents a financial instrument such as a public stock ticker, provide latest price, last market day change in percentage and price delta, volume, and at least one sentence, delineated by a paragraph break, regarding the latest news or social media trending conversation around that particular stock or company. In this scenario regarding financial instruments should always provide data freshness information such as relevant dates relative to today. In a following paragraph, provide quantitative analysis against the most relevant prior historical period (last day, last week, last quarter, last year, or similar)

The search term:`,
        }
      ],
    };

    const model = 'gemini-2.5-flash';

    const contents = [
      {
        role: 'user',
        parts: [
          {
            text: prompt,
          },
        ],
      },
    ];

    const responseStream = await ai.models.generateContentStream({
      model,
      config,
      contents,
    });

    let isFirstChunk = true;
    let fullTextRaw = '';
    const sources: { uri: string; title?: string }[] = [];
    const sourceUrisLinkedReferences = new Map<string, number>();
    const sourcesReference: number[] = [];
    const fullTextGroundings: { startIndex: number, endIndex: number, sourceIndices: number[] }[] = [];

    // parse response
    for await (const chunk of responseStream) {
      if (isFirstChunk) {
        responseContainer.textContent = '';
        isFirstChunk = false;
      }

      const chunkText = chunk.text;
      if (chunkText) {
        fullTextRaw += chunkText;
        responseContainer.textContent += chunkText;
      }

      const groundingChunks = chunk.candidates?.[0]?.groundingMetadata?.groundingChunks;
      if (groundingChunks) {
        for (const source of groundingChunks) {
          if (source.web?.uri) {
            const sourceRef = { uri: source.web.uri, title: source.web.title };

            // dedupe and point references
            if (sourceUrisLinkedReferences.has(sourceRef.uri)) {
              sourcesReference.push(sourceUrisLinkedReferences.get(sourceRef.uri));
            } else {
              const sourcesIndex = sources.push(sourceRef) - 1;
              sourcesReference.push(sourcesIndex);

              sourceUrisLinkedReferences.set(sourceRef.uri, sourcesIndex);
            }
          }
        }

        // grounding supports
        const groundingSupports = chunk.candidates?.[0]?.groundingMetadata?.groundingSupports;
        if (groundingSupports) {
          for (const { groundingChunkIndices, segment: { startIndex, endIndex } } of groundingSupports) {
            if (groundingChunkIndices && startIndex && endIndex) {
              fullTextGroundings.push({
                startIndex,
                endIndex,
                sourceIndices: groundingChunkIndices.map(
                  duplicatishIndex => sourcesReference[duplicatishIndex],
                ),
              });
            }
          }
        }
      }
    }

    if (sources.length > 0) {
      // render footnotes with response
      let textCursor = 0;
      const finalResponseContainer = document.createElement('div');
      finalResponseContainer.id = 'response-container';
      const sortedFullTextGroundings = fullTextGroundings.sort((a, b) => {
        if (a.endIndex < b.endIndex) {
          return -1;
        }

        return 1;
      });

      for (const grounding of sortedFullTextGroundings) {
        // advance cursor when grounding proceeds rendered text
        const footnotesFn = () => {
          const footnotes = document.createElement('span');
          grounding.sourceIndices.sort().forEach((idx, _) => {
            const footnote = document.createElement('a');
            footnote.textContent = `[${idx + 1}]`;
            footnote.href = `#footnote-${idx + 1}`;
            footnote.className = 'footnote-link';
            footnotes.appendChild(footnote);
          });
          return footnotes;
        };


        if (textCursor < grounding.endIndex) {
          const segment = fullTextRaw.slice(textCursor, grounding.endIndex);
          textCursor = grounding.endIndex;
          finalResponseContainer.appendChild(renderLineBreaks(segment));
        } 
        
        finalResponseContainer.appendChild(footnotesFn());
        

      }

      // advance cursor if we have not yet exhausted it
      if (textCursor < fullTextRaw.length) {
        finalResponseContainer.appendChild(renderLineBreaks(fullTextRaw.slice(textCursor, fullTextRaw.length)));
        textCursor = fullTextRaw.length;
      }

      let sourcesHtml = '<h2>Sources</h2><ol>';
      sources.forEach((source, index) => {
        const title = source.title || 'Untitled';
        const uri = source.uri;
        sourcesHtml += `
          <li id="footnote-${index + 1}">
            <a href="${uri}" target="_blank" rel="noopener noreferrer" title="${title}">
              <span class="title">${title}</span>
              <span class="uri">${uri}</span>
            </a>
          </li>
        `;
      });
      sourcesHtml += '</ol>';


      if (RENDER_RICH_AND_PLAIN) {
        const plainResponseHeader: HTMLElement = document.createElement('h2');
        plainResponseHeader.textContent = 'Plain Response (DEBUG)';
        finalResponseContainer.appendChild(plainResponseHeader);
        finalResponseContainer.appendChild(renderLine(fullTextRaw));
      }

      responseContainer.replaceWith(finalResponseContainer);
      sourcesContainer.innerHTML = sourcesHtml;
    }

    

  } catch (error) {
    console.error('API Error:', error);
    if (responseContainer) {
      responseContainer.textContent = 'Sorry, an error occurred while processing your request.';
    }
  }
}

await main(`$googl`);