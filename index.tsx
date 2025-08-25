import {
  GoogleGenAI,
} from '@google/genai';

import { renderLineBreaks, renderLine } from './parser.tsx';

const RENDER_RICH_AND_PLAIN = false;

async function main(prompt: string, requestId: number) {
  const responseContainer = document.getElementById('response-container');
  const sourcesContainer = document.getElementById('sources-container');
  const historyContainer = document.getElementById('history-container');

  if (!responseContainer || !sourcesContainer || !historyContainer) {
    console.error('Required DOM elements not found.');
    return;
  }

  // archive prior
  if (responseContainer && historyContainer && sourcesContainer) {
    const entryElement = document.createElement('div');
    entryElement.className = 'entry';

    const pastResponseNode = responseContainer.cloneNode(true) as HTMLElement;
    pastResponseNode.id = '';
    entryElement.appendChild(pastResponseNode);

    const pastSourcesNode = sourcesContainer.cloneNode(true) as HTMLElement;
    pastSourcesNode.id = '';
    entryElement.appendChild(pastSourcesNode);

    historyContainer.prepend(entryElement);

    responseContainer.replaceWith(document.getElementById('response-container'));
    responseContainer.innerHTML = '';
  }


  const queryTitle = document.createElement('h2');
  queryTitle.textContent = prompt;
  responseContainer.prepend(queryTitle);

  const thinkingQuerySuspender = document.createElement('span');
  thinkingQuerySuspender.textContent = 'Thinking...';

  responseContainer.appendChild(thinkingQuerySuspender);
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

    let firstChunk = true;
    let fullTextRaw = '';
    const sources: { uri: string; title?: string }[] = [];
    const sourceUrisLinkedReferences = new Map<string, number>();
    const sourcesReference: number[] = [];
    const fullTextGroundings: { startIndex: number, endIndex: number, sourceIndices: number[] }[] = [];

    // parse response
    for await (const chunk of responseStream) {
      const chunkText = chunk.text;

      const chunkTextElement = document.createElement('span');
      responseContainer.appendChild(chunkTextElement);

      if (firstChunk) {
        firstChunk = false;
        thinkingQuerySuspender.remove();
      }

      if (chunkText) {
        fullTextRaw += chunkText;
        chunkTextElement.textContent += chunkText;
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
            footnote.href = `#footnote-request_${requestId}-${idx + 1}`;
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
          <li id="footnote-request_${requestId}-${index + 1}">
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


      const queryTitle = document.createElement('h2');
      queryTitle.textContent = prompt;
      finalResponseContainer.prepend(queryTitle);

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

function initializeApp() {
  const searchForm = document.getElementById('search-form') as HTMLFormElement;
  const searchInput = document.getElementById('search-input') as HTMLInputElement;
  const searchButton = document.getElementById('search-button') as HTMLButtonElement;

  let requestId = 0;

  if (!searchForm || !searchInput || !searchButton) {
    console.error('Required DOM elements for search not found.');
    return;
  }

  searchForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const prompt = searchInput.value.trim();
    if (!prompt) {
      return;
    }

    // Disable form elements
    searchInput.disabled = true;
    searchButton.disabled = true;
    searchButton.textContent = 'Searching...';

    const startTime = performance.now();
    const generationDate = new Date();

    try {
      requestId += 1;
      await main(prompt, requestId);

      const endTime = performance.now();
      const durationSeconds = ((endTime - startTime) / 1000).toFixed(2);

      const metadataElement = document.createElement('p');
      metadataElement.className = 'response-metadata';
      metadataElement.textContent = `Generated on ${generationDate.toLocaleString()} in ${durationSeconds} seconds.`;

      const responseContainer = document.getElementById('response-container');
      if (responseContainer) {
        responseContainer.appendChild(metadataElement);
      }

      searchInput.value = '';

    } catch (error) {
      // The main function already handles displaying an error message.
      // We just log it here for debugging.
      console.error('An error occurred during the search operation:', error);
    } finally {
      // Re-enable form elements
      searchInput.disabled = false;
      searchButton.disabled = false;
      searchButton.textContent = 'Search';

      searchInput.focus();
    }
  });
  searchInput.focus();
}

initializeApp();