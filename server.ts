import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const IS_PROD = process.env.NODE_ENV === 'production';

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function readSafeLocalAssetImage(imageUrl?: string): { mimeType: string; data: string } | null {
  if (!imageUrl || !imageUrl.startsWith('/src/assets/images/')) {
    return null;
  }
  const safeName = path.basename(imageUrl);
  const candidatePaths = [
    path.resolve(__dirname, 'src', 'assets', 'images', safeName),
    path.resolve(__dirname, 'dist', 'src', 'assets', 'images', safeName),
  ];
  for (const filePath of candidatePaths) {
    if (fs.existsSync(filePath)) {
      const buffer = fs.readFileSync(filePath);
      const ext = path.extname(safeName).toLowerCase();
      const mimeType = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
      return { mimeType, data: buffer.toString('base64') };
    }
  }
  return null;
}

function safeParseModelJson(rawText: string | undefined): Record<string, unknown> {
  const cleaned = (rawText ?? '{}')
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();
  return JSON.parse(cleaned || '{}') as Record<string, unknown>;
}

function formatApiError(err: unknown): { status: number; message: string; code: string } {
  const raw = err instanceof Error ? err.message : String(err);
  if (raw.includes('PERMISSION_DENIED') || raw.includes('API_KEY_INVALID') || raw.includes('403') || raw.includes('400')) {
    return {
      status: 400,
      code: 'GEMINI_AUTH_ERROR',
      message: 'Gemini API rejected the request. Verify GEMINI_API_KEY in the Settings > Secrets panel.',
    };
  }
  if (raw.includes('RESOURCE_EXHAUSTED') || raw.includes('429')) {
    return {
      status: 429,
      code: 'GEMINI_QUOTA_ERROR',
      message: 'Gemini API quota reached (429). Check your key quota or retry shortly.',
    };
  }
  return {
    status: 500,
    code: 'GEMINI_UPSTREAM_ERROR',
    message: `Gemini request failed: ${raw}`,
  };
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '15mb' }));

  app.get('/api/health', (_req, res) => {
    const client = getGeminiClient();
    res.json({
      ok: true,
      hasGeminiKey: Boolean(client),
      mode: IS_PROD ? 'production' : 'development',
    });
  });

  app.post('/api/ai/operator', async (req, res) => {
    const ai = getGeminiClient();
    if (!ai) {
      res.status(503).json({
        code: 'MISSING_API_KEY',
        error: 'GEMINI_API_KEY is not configured in environment secrets. Configure it in Settings > Secrets or use the Local Store Inspection tool.',
      });
      return;
    }

    try {
      const { requestText, storeContext, attachments = [], clarificationAnswer } = req.body as {
        requestText: string;
        storeContext: Record<string, unknown>;
        attachments?: Array<{ name: string; mimeType: string; textContent?: string; base64Data?: string }>;
        clarificationAnswer?: string;
      };

      const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];

      for (const att of attachments.slice(0, 3)) {
        if (att.base64Data && att.mimeType.startsWith('image/')) {
          parts.push({
            inlineData: {
              mimeType: att.mimeType,
              data: att.base64Data,
            },
          });
        } else if (att.textContent) {
          parts.push({
            text: `Attached file (${att.name}, ${att.mimeType}):\n${att.textContent.slice(0, 8000)}`,
          });
        }
      }

      parts.push({
        text: `User request: "${requestText}"${clarificationAnswer ? `\nUser clarification: "${clarificationAnswer}"` : ''}\n\nVerified Demo Store Context (JSON):\n${JSON.stringify(storeContext).slice(0, 24000)}`,
      });

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: { parts },
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          systemInstruction:
            'You are AIRA, an AI Retail Automation Agent operating a DEMO STORE (not connected to a live storefront). Rules: 1) Never invent product facts, prices, SKUs, costs, order statuses, tracking numbers, or profit. 2) If unitCost is null on any sold item, state explicitly that profit cannot be calculated without fabricating cost data. 3) If key information is missing to execute a write/draft task, return ONE focused clarificationQuestion and empty steps; never ask about info already in storeContext. 4) Classify each step accurately as read_only, draft, reversible_change, or consequential_external. 5) Keep actions honest and clearly mark external/mutating actions as simulated in demo.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              understanding: { type: Type.STRING },
              retrievedContext: { type: Type.ARRAY, items: { type: Type.STRING } },
              assumptions: { type: Type.ARRAY, items: { type: Type.STRING } },
              clarificationQuestion: { type: Type.STRING },
              steps: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    description: { type: Type.STRING },
                    classification: { type: Type.STRING },
                    actionType: { type: Type.STRING },
                    affectedRecords: { type: Type.ARRAY, items: { type: Type.STRING } },
                    resultDetail: { type: Type.STRING },
                    externalMessageText: { type: Type.STRING },
                    riskNote: { type: Type.STRING },
                    missingInformation: { type: Type.ARRAY, items: { type: Type.STRING } },
                  },
                },
              },
            },
          },
        },
      });

      const parsed = safeParseModelJson(response.text);
      res.json({ plan: parsed });
    } catch (err) {
      const mapped = formatApiError(err);
      res.status(mapped.status).json({ code: mapped.code, error: mapped.message });
    }
  });

  app.post('/api/ai/extract-product', async (req, res) => {
    const ai = getGeminiClient();
    if (!ai) {
      res.status(503).json({
        code: 'MISSING_API_KEY',
        error: 'GEMINI_API_KEY is not configured in environment secrets. Configure it in Settings > Secrets or extract from CSV locally.',
      });
      return;
    }

    try {
      const { fileName, mimeType, base64Data, textContent, supportedCategories } = req.body as {
        fileName: string;
        mimeType: string;
        base64Data?: string;
        textContent?: string;
        supportedCategories: string[];
      };

      const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];
      if (base64Data && mimeType.startsWith('image/')) {
        parts.push({ inlineData: { mimeType, data: base64Data } });
      }
      if (textContent) {
        parts.push({ text: `File text content (${fileName}):\n${textContent.slice(0, 10000)}` });
      }
      parts.push({
        text: `Analyze "${fileName}" and extract ONLY visibly confirmed or explicitly supplied product attributes. Supported categories: ${supportedCategories.join(', ')}. Never invent price, SKU, weight, stock, or unseen specs; list any missing/uncertain fields in unverifiedFields and missingFields.`,
      });

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: { parts },
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          systemInstruction:
            'Extract e-commerce catalog fields strictly from supplied files/images. Do not guess prices, SKUs, dimensions, ingredients, or materials unless explicitly readable or visible. Always suggest clean SEO title and description based strictly on known details.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              description: { type: Type.STRING },
              category: { type: Type.STRING },
              price: { type: Type.NUMBER },
              sku: { type: Type.STRING },
              tags: { type: Type.ARRAY, items: { type: Type.STRING } },
              seoTitle: { type: Type.STRING },
              seoDescription: { type: Type.STRING },
              attributes: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    key: { type: Type.STRING },
                    value: { type: Type.STRING },
                  },
                },
              },
              unverifiedFields: { type: Type.ARRAY, items: { type: Type.STRING } },
              missingFields: { type: Type.ARRAY, items: { type: Type.STRING } },
            },
          },
        },
      });

      const extracted = safeParseModelJson(response.text);
      res.json({ extracted });
    } catch (err) {
      const mapped = formatApiError(err);
      res.status(mapped.status).json({ code: mapped.code, error: mapped.message });
    }
  });

  app.post('/api/ai/suggest-tags', async (req, res) => {
    const ai = getGeminiClient();
    if (!ai) {
      res.status(503).json({
        code: 'MISSING_API_KEY',
        error: 'GEMINI_API_KEY is not configured in environment secrets. Configure it in Settings > Secrets or use local keyword suggestion.',
      });
      return;
    }

    try {
      const { title, description, category, imageBase64, imageMimeType, imageUrl } = req.body as {
        title: string;
        description: string;
        category: string;
        imageBase64?: string;
        imageMimeType?: string;
        imageUrl?: string;
      };

      const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];
      if (imageBase64 && imageMimeType?.startsWith('image/')) {
        parts.push({ inlineData: { mimeType: imageMimeType, data: imageBase64 } });
      } else {
        const localImg = readSafeLocalAssetImage(imageUrl);
        if (localImg) {
          parts.push({ inlineData: localImg });
        }
      }

      parts.push({
        text: `Analyze this product's title, description, category, and image (if attached) to suggest concise lowercase e-commerce tags grouped into categories: "Material & Specs", "Use Case", "Audience & Channel", or "Merchandising".\nTitle: ${title}\nCategory: ${category}\nDescription: ${description}`,
      });

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: { parts },
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          systemInstruction:
            'Generate 6 to 10 relevant, concise lowercase hyphenated tags based strictly on the product title, description, and visible image attributes. Mark source as "title", "description", or "image", and confidence as "verified" (explicitly stated or visibly clear) or "inferred" (reasonable merchandising keyword). Never fabricate technical specs not present.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              suggestions: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    tag: { type: Type.STRING },
                    category: { type: Type.STRING },
                    source: { type: Type.STRING },
                    confidence: { type: Type.STRING },
                  },
                },
              },
            },
          },
        },
      });

      const parsed = safeParseModelJson(response.text);
      res.json(parsed);
    } catch (err) {
      const mapped = formatApiError(err);
      res.status(mapped.status).json({ code: mapped.code, error: mapped.message });
    }
  });

  app.post('/api/ai/draft-reply', async (req, res) => {
    const ai = getGeminiClient();
    if (!ai) {
      res.status(503).json({
        code: 'MISSING_API_KEY',
        error: 'GEMINI_API_KEY is not configured in environment secrets. Configure it in Settings > Secrets or use policy template drafting.',
      });
      return;
    }

    try {
      const { conversation, order, shipment, policies, storeName } = req.body as {
        conversation: Record<string, unknown>;
        order: Record<string, unknown> | null;
        shipment: Record<string, unknown> | null;
        policies: Array<{ id: string; title: string; fullText: string }>;
        storeName: string;
      };

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: `Store: ${storeName}\nConversation:\n${JSON.stringify(conversation)}\nLinked Order:\n${JSON.stringify(order)}\nLinked Shipment:\n${JSON.stringify(shipment)}\nApproved Store Policies:\n${JSON.stringify(policies)}`,
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          systemInstruction:
            'Classify the customer inquiry (shipping_delay, order_status, return_request, product_question, policy_faq, or other), write a concise 2-sentence summary, and draft a calm, helpful reply grounded ONLY in the provided order, shipment, and approved policy facts. Never promise unverified delivery dates or unauthorized refunds. List any missing information needed before replying.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              classification: { type: Type.STRING },
              aiSummary: { type: Type.STRING },
              draftReply: { type: Type.STRING },
              missingInformation: { type: Type.ARRAY, items: { type: Type.STRING } },
            },
          },
        },
      });

      const parsed = safeParseModelJson(response.text);
      res.json(parsed);
    } catch (err) {
      const mapped = formatApiError(err);
      res.status(mapped.status).json({ code: mapped.code, error: mapped.message });
    }
  });

  if (!IS_PROD) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`AIRA server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start AIRA server:', err);
  process.exit(1);
});
