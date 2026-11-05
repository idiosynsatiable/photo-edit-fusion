import type { FastifyInstance } from 'fastify';
import {
  AiAnalyzeRequestSchema,
  AiPlanRequestSchema,
  SceneAnalysisSchema,
  EditPlanSchema,
  type SceneAnalysis,
  type EditPlan,
} from '@pef/shared';

const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';

type GeminiPart = { text?: string; inlineData?: { mimeType: string; data: string } };

async function geminiJson(
  apiKey: string,
  model: string,
  parts: GeminiPart[],
  timeoutMs: number,
): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(
      `${GEMINI_ENDPOINT}/${encodeURIComponent(model)}:generateContent`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({
          contents: [{ role: 'user', parts }],
          generationConfig: { responseMimeType: 'application/json', temperature: 0.2 },
        }),
        signal: controller.signal,
      },
    );
    if (!response.ok) {
      // Never forward upstream response bodies because they can contain provider diagnostics.
      throw new Error(`gemini_http_${response.status}`);
    }
    const payload = (await response.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const text = payload.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('');
    if (!text) throw new Error('gemini_empty_response');
    return JSON.parse(text) as unknown;
  } finally {
    clearTimeout(timeout);
  }
}

function decodeImageData(value: string): string {
  const comma = value.indexOf(',');
  return comma >= 0 && value.slice(0, comma).startsWith('data:') ? value.slice(comma + 1) : value;
}

function disabled(reply: { status: (code: number) => { send: (body: unknown) => unknown } }) {
  return reply.status(503).send({
    error: 'integration_disabled',
    integration: 'gemini',
    reason: 'GEMINI_API_KEY is not configured on the server',
  });
}

export async function aiEditRoutes(app: FastifyInstance): Promise<void> {
  app.post('/api/ai-edit/analyze', async (req, reply) => {
    const parsed = AiAnalyzeRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'validation_error',
        details: parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      });
    }
    if (!app.config.GEMINI_API_KEY) return disabled(reply);

    const { imageBase64, mimeType } = parsed.data;
    const encoded = decodeImageData(imageBase64);
    const bytes = Buffer.from(encoded, 'base64');
    if (!bytes.length || bytes.length > app.config.PEF_MAX_UPLOAD_BYTES) {
      return reply.status(413).send({ error: 'image_size_invalid', maxBytes: app.config.PEF_MAX_UPLOAD_BYTES });
    }

    try {
      const raw = await geminiJson(app.config.GEMINI_API_KEY, app.config.GEMINI_MODEL, [
        { text: `Analyze the entire image. Return JSON only matching this schema: {imageWidth:number,imageHeight:number,summary:string,regions:[{id:string,kind:"person"|"face"|"object"|"background"|"text"|"unknown",label:string,confidence:number,bounds:{x:number,y:number,width:number,height:number},text?:string,protected:boolean}],warnings:string[]}. Bounds are normalized 0..1. Include salient objects, every visible person/face, background, and readable text when possible. Do not infer sensitive traits. Mark faces and important identity-bearing details protected. Confidence is 0..1. If exact dimensions are unknown, estimate aspect-preserving dimensions and mention this in warnings.` },
        { inlineData: { mimeType, data: encoded } },
      ], app.config.GEMINI_TIMEOUT_MS);
      const result = SceneAnalysisSchema.parse({
        ...(raw as Record<string, unknown>),
        provider: 'gemini',
        analyzedAt: new Date().toISOString(),
      }) satisfies SceneAnalysis;
      return reply.send({ analysis: result });
    } catch (error) {
      req.log.warn({ code: error instanceof Error ? error.message : 'unknown' }, 'AI image analysis failed');
      return reply.status(502).send({ error: 'ai_analysis_failed', message: 'Image analysis failed. Please retry.' });
    }
  });

  app.post('/api/ai-edit/plan', async (req, reply) => {
    const parsed = AiPlanRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'validation_error',
        details: parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      });
    }
    if (!app.config.GEMINI_API_KEY) return disabled(reply);
    const body = parsed.data;

    try {
      const raw = await geminiJson(app.config.GEMINI_API_KEY, app.config.GEMINI_MODEL, [{
        text: `Create a non-destructive, reviewable image editing plan for this instruction: ${body.instruction}
Scene analysis: ${JSON.stringify(body.analysis)}
Prior project operations: ${JSON.stringify(body.priorOperations)}
Preserve identity: ${body.preserveIdentity}.
Return JSON matching {id:string,userInstruction:string,rationale:string,operations:[{id:string,type:"remove-object"|"replace-object"|"adjust"|"add-text"|"recompose",title:string,description:string,targetRegionIds:string[],prompt?:string,reversible:boolean,requiresConfirmation:boolean}],identityProtection:{preserveFaces:boolean,protectedRegionIds:string[]},requiresApproval:true,createdAt:string}.
Use only region IDs from the analysis. Preserve faces by default. Set requiresConfirmation for ambiguous, destructive, face-affecting, or generative replacements. Do not claim edits have been executed.`,
      }], app.config.GEMINI_TIMEOUT_MS);
      const plan = EditPlanSchema.parse({
        ...(raw as Record<string, unknown>),
        id: crypto.randomUUID(),
        userInstruction: body.instruction,
        identityProtection: {
          preserveFaces: body.preserveIdentity,
          protectedRegionIds: body.analysis.regions.filter((r) => r.protected || (body.preserveIdentity && r.kind === 'face')).map((r) => r.id),
        },
        requiresApproval: true,
        createdAt: new Date().toISOString(),
      }) satisfies EditPlan;
      return reply.send({ plan });
    } catch (error) {
      req.log.warn({ code: error instanceof Error ? error.message : 'unknown' }, 'AI edit planning failed');
      return reply.status(502).send({ error: 'ai_plan_failed', message: 'Could not prepare an edit plan. Please revise the instruction or retry.' });
    }
  });
}
