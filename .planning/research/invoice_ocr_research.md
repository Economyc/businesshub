# Invoice OCR & Data Extraction Research

**Domain:** AI-powered invoice/receipt data extraction for business management app
**Researched:** 2026-04-03
**Overall confidence:** HIGH

---

## Executive Summary

The project already uses Firebase, which makes **Firebase AI Logic + Gemini** the clear winner for invoice OCR. Firebase AI Logic provides a client-side SDK that calls Gemini models directly from the web app -- no backend needed, with Firebase App Check for security. The free tier of Gemini 2.5 Flash (10 RPM, 250 requests/day) is sufficient for a small business tool.

For Excel files, the project already has `xlsx` (SheetJS) and `papaparse` installed -- no new dependencies needed. The pipeline is: parse Excel to JSON arrays, send to Gemini for categorization, return structured data.

The recommended architecture is a two-track pipeline: photos go through Vision LLM for OCR + extraction, while Excel/CSV files get parsed locally first and then sent as text to the LLM for categorization only. Both tracks output the same structured JSON schema validated with Zod.

---

## 1. Vision LLM for Invoice OCR

### Recommendation: Google Gemini via Firebase AI Logic

**Why Gemini over alternatives:**

| Provider | Free Tier | Vision Support | Integration with Project |
|----------|-----------|----------------|--------------------------|
| **Gemini (Firebase AI Logic)** | 10 RPM, 250 req/day (Flash) | Native multimodal | Already uses Firebase -- zero new infra |
| Groq (Llama 3.2 Vision) | ~30 RPM, limited TPD | 11B and 90B models | Separate API key, new dependency |
| Together AI | No free tier ($5 minimum) | Llama 3.2 Vision | Separate API key, new dependency |

**Gemini wins because:**
1. The project already uses Firebase -- Firebase AI Logic is a natural extension
2. No backend needed -- SDK calls Gemini directly from the client
3. Firebase App Check provides security against unauthorized API usage
4. Structured output with JSON schema enforcement (no parsing needed)
5. Free tier is generous enough for a small business tool (250 invoices/day)

### Firebase AI Logic Setup

Already installed: `firebase` package. Additional setup:

```typescript
import { getAI, getGenerativeModel, GoogleAIBackend } from "firebase/ai";

// Use existing Firebase app instance
const ai = getAI(firebaseApp, { backend: new GoogleAIBackend() });
const model = getGenerativeModel(ai, { model: "gemini-2.5-flash" });
```

**Important:** Enable the "Firebase AI Logic" API in Google Cloud Console and configure App Check.

### Model Selection

Use **Gemini 2.5 Flash** (not Flash-Lite, not Pro):
- Flash: 10 RPM, 250 req/day free -- best balance of quality and availability
- Flash-Lite: 15 RPM, 1000 req/day free -- but lower quality for complex invoices
- Pro: Only 5 RPM, 100 req/day free -- overkill for invoices

**Note:** Gemini 2.0 Flash shuts down June 1, 2026. Use `gemini-2.5-flash` from the start.

### Sending Images for Analysis

```typescript
// Helper: convert File to base64 part
async function fileToGenerativePart(file: File) {
  const base64 = await new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
    reader.readAsDataURL(file);
  });
  return {
    inlineData: { data: base64, mimeType: file.type },
  };
}

// Analyze invoice
const imagePart = await fileToGenerativePart(invoiceFile);
const result = await model.generateContent([INVOICE_PROMPT, imagePart]);
```

**Request size limit:** 20 MB total per request.

---

## 2. Structured Output with JSON Schema

### Use Gemini's Native Structured Output

Gemini supports `responseMimeType: "application/json"` with a JSON schema, which guarantees valid JSON output matching your schema. No parsing or error handling needed.

**Recommended approach: Zod schema -> JSON schema -> Gemini**

```typescript
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

const InvoiceLineItemSchema = z.object({
  description: z.string().describe("Description of the item or service"),
  quantity: z.number().optional().describe("Quantity if applicable"),
  unit_price: z.number().optional().describe("Unit price if shown"),
  total: z.number().describe("Line item total amount"),
});

const InvoiceExtractionSchema = z.object({
  vendor_name: z.string().describe("Name of the vendor/supplier"),
  vendor_rut: z.string().optional().describe("RUT or tax ID of the vendor"),
  invoice_number: z.string().optional().describe("Invoice or receipt number"),
  date: z.string().describe("Invoice date in ISO 8601 format (YYYY-MM-DD)"),
  currency: z.string().describe("Currency code, e.g. CLP, USD"),
  subtotal: z.number().optional().describe("Subtotal before taxes"),
  tax_amount: z.number().optional().describe("Tax amount (IVA)"),
  total_amount: z.number().describe("Total amount of the invoice"),
  payment_method: z.string().optional().describe("Payment method if shown"),
  category_suggestion: z.string().describe("Suggested expense category"),
  line_items: z.array(InvoiceLineItemSchema).describe("Individual line items"),
  confidence: z.number().min(0).max(1).describe("Confidence score 0-1"),
  notes: z.string().optional().describe("Any additional relevant information"),
});

// Use with Gemini
const model = getGenerativeModel(ai, {
  model: "gemini-2.5-flash",
  generationConfig: {
    responseMimeType: "application/json",
    responseSchema: zodToJsonSchema(InvoiceExtractionSchema),
    temperature: 0, // Critical: zero temperature for extraction tasks
  },
});
```

**New dependencies needed:** `zod` and `zod-to-json-schema`

---

## 3. Prompting Strategy for Invoice Extraction

### The Prompt

```typescript
const INVOICE_EXTRACTION_PROMPT = `You are an expert invoice and receipt data extractor for Chilean businesses.

Analyze this invoice/receipt image and extract all structured data.

Rules:
- Dates must be in ISO 8601 format (YYYY-MM-DD)
- Currency should be the 3-letter code (CLP for Chilean Pesos, USD for US Dollars)
- If a field is not visible or unclear, omit it (use null)
- For category_suggestion, choose from: Arriendos, Servicios, Suministros, Marketing, 
  Sueldos, Impuestos, Seguros, Transporte, Alimentacion, Tecnologia, Otros
- confidence should reflect how readable and complete the document is (1.0 = perfect, 0.5 = partially readable)
- Extract ALL line items visible in the document
- For RUT, include the full format (XX.XXX.XXX-X)
- Amounts should be numbers without currency symbols or thousand separators`;
```

### Key Prompting Best Practices

1. **Temperature 0** -- Essential for extraction. You want consistency, not creativity.
2. **Document first in content array** -- Place the image before the text prompt for better attention.
3. **Explicit field descriptions** -- Tell the model exactly what format you expect.
4. **Category list in prompt** -- Constrain suggestions to your actual categories.
5. **Confidence scoring** -- Ask the model to self-assess readability.
6. **Chilean context** -- Mention RUT, CLP, IVA explicitly since the app targets Chilean businesses.

### Handling Edge Cases

- **Poor quality photos:** The confidence score handles this. If confidence < 0.6, flag for manual review.
- **Multi-page invoices:** Send all pages as separate image parts in a single request (Gemini supports multiple images).
- **Receipts vs formal invoices:** The same prompt handles both -- Gemini understands document structure.

---

## 4. Excel/CSV File Processing

### Already Installed: SheetJS (`xlsx`) and PapaParse (`papaparse`)

No new dependencies needed.

### Excel Processing Pipeline

```typescript
import * as XLSX from "xlsx";

async function parseExcelFile(file: File): Promise<Record<string, unknown>[][]> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  
  // Parse all sheets
  return workbook.SheetNames.map((name) => {
    const sheet = workbook.Sheets[name];
    return XLSX.utils.sheet_to_json(sheet);
  });
}
```

### CSV Processing Pipeline

```typescript
import Papa from "papaparse";

function parseCSVFile(file: File): Promise<Record<string, string>[]> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => resolve(results.data as Record<string, string>[]),
      error: (err) => reject(err),
    });
  });
}
```

### LLM Categorization of Parsed Data

After parsing, send the data as text (not as an image) to Gemini for categorization:

```typescript
const CATEGORIZATION_PROMPT = `You are a financial data categorizer for a Chilean business.

Given this transaction data extracted from a spreadsheet, categorize each row 
and normalize the data into the standard format.

Categories: Arriendos, Servicios, Suministros, Marketing, Sueldos, Impuestos, 
Seguros, Transporte, Alimentacion, Tecnologia, Otros

Transaction data:
${JSON.stringify(parsedRows, null, 2)}

For each transaction, determine: vendor name, date, amount, currency, and category.`;
```

**Important:** For Excel/CSV, use the text-only model (cheaper, faster) since there are no images to process. You can still use `gemini-2.5-flash` but the token cost is lower without image tokens.

---

## 5. Image Preprocessing Before Sending to LLM

### Recommended Pipeline

```typescript
async function preprocessInvoiceImage(file: File): Promise<File> {
  // 1. Check file size -- if under 2MB, send as-is
  if (file.size < 2 * 1024 * 1024) return file;
  
  // 2. Resize and compress using Canvas API
  const img = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  
  // Max dimension: 1024px (sufficient for OCR, saves tokens)
  const maxDim = 1024;
  const scale = Math.min(maxDim / img.width, maxDim / img.height, 1);
  canvas.width = img.width * scale;
  canvas.height = img.height * scale;
  
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  
  // 3. Convert to JPEG at 85% quality (best size/quality for OCR)
  const blob = await new Promise<Blob>((resolve) =>
    canvas.toBlob((b) => resolve(b!), "image/jpeg", 0.85)
  );
  
  return new File([blob], file.name.replace(/\.\w+$/, ".jpg"), {
    type: "image/jpeg",
  });
}
```

### Key Guidelines

| Setting | Value | Rationale |
|---------|-------|-----------|
| Max dimension | 1024px | Sufficient for text recognition, reduces token cost |
| JPEG quality | 85% | Best balance -- 50% loses too much detail for small text |
| Format | JPEG | Smaller than PNG, sufficient for documents |
| Max file size | 20MB (API limit) | After preprocessing, usually under 500KB |

### What NOT to do

- Do NOT convert to grayscale -- color helps with table/header detection
- Do NOT apply sharpening filters -- Gemini handles blurry images well
- Do NOT upscale small images -- adds noise, not information

---

## 6. Complete Data Pipeline Architecture

```
TRACK 1: Photo/PDF Invoice
  User uploads photo
    -> preprocessInvoiceImage() [resize, compress]
    -> fileToGenerativePart() [base64 encode]
    -> Gemini 2.5 Flash (Vision + Structured Output)
    -> Zod validation
    -> InvoiceData JSON

TRACK 2: Excel/CSV File
  User uploads spreadsheet
    -> XLSX.read() or Papa.parse() [local parsing]
    -> JSON rows
    -> Gemini 2.5 Flash (Text + Structured Output)
    -> Zod validation
    -> InvoiceData[] JSON array

BOTH TRACKS:
  InvoiceData JSON
    -> Map category_suggestion to app categories
    -> Show user for review/confirmation
    -> Save to Firestore
```

### Category Mapping

```typescript
const CATEGORY_MAP: Record<string, string> = {
  "Arriendos": "rent",
  "Servicios": "services", 
  "Suministros": "supplies",
  "Marketing": "marketing",
  "Sueldos": "payroll",
  "Impuestos": "taxes",
  "Seguros": "insurance",
  "Transporte": "transport",
  "Alimentacion": "food",
  "Tecnologia": "technology",
  "Otros": "other",
};
```

The LLM suggests a category in Spanish (matching the prompt), which maps to the internal category ID used by the app.

---

## 7. Fallback Strategy

### Primary: Gemini via Firebase AI Logic (free tier)
- 250 requests/day covers most small businesses
- No backend, no API key exposed (Firebase App Check)

### Fallback: Groq (Llama 3.2 Vision)
- If Gemini free tier is exhausted or down
- Requires separate API key (store in Firebase Functions or environment)
- Free tier available but rate limits are lower
- Does NOT support native structured output -- need to parse JSON from text response

### Fallback implementation

```typescript
async function extractInvoiceData(file: File): Promise<InvoiceData> {
  try {
    return await extractWithGemini(file);
  } catch (error) {
    if (isRateLimitError(error)) {
      console.warn("Gemini rate limit hit, falling back to Groq");
      return await extractWithGroq(file);
    }
    throw error;
  }
}
```

**Recommendation:** Start with Gemini only. Add Groq fallback only if rate limits become a real problem.

---

## 8. Required New Dependencies

| Package | Purpose | Size |
|---------|---------|------|
| `zod` | Schema definition and validation | ~13KB gzipped |
| `zod-to-json-schema` | Convert Zod schemas to JSON Schema for Gemini | ~3KB gzipped |

**Already installed:** `firebase`, `xlsx`, `papaparse`

**NOT needed:**
- `@google/genai` -- Firebase AI Logic SDK is built into `firebase` package
- `tesseract.js` -- Gemini handles OCR natively, no need for separate OCR
- `sharp` / `jimp` -- Canvas API handles image preprocessing in the browser

---

## 9. Pitfalls and Warnings

### Critical

1. **Do NOT use `@google/generative-ai` (old SDK).** Firebase AI Logic is the replacement. Google recommends migrating from the standalone Google AI client SDK to Firebase AI Logic for web apps.

2. **Gemini 2.0 Flash shuts down June 1, 2026.** Use `gemini-2.5-flash` from day one.

3. **Free tier quotas were cut 50-80% in Dec 2025.** The 250 req/day for Flash is the CURRENT limit, not the old generous one. Plan accordingly.

4. **20MB total request size limit.** Always preprocess images to keep requests under this.

### Moderate

5. **Rate limits are per Google Cloud project, not per API key.** If you have multiple environments sharing the same project, they share the quota.

6. **Daily quota resets at midnight Pacific Time.** Chilean users hitting the API late at night (Chilean time) might hit yesterday's quota.

7. **SheetJS Community Edition (CE) has limitations.** The `xlsx` package (CE) cannot write certain formats and has some parsing quirks. For reading, it works fine.

### Minor

8. **Base64 encoding increases payload size by ~33%.** A 3MB image becomes ~4MB as base64. Factor this into the 20MB limit.

9. **Currency detection is imperfect.** Chilean invoices often show "$" which could be CLP or USD. The prompt should specify CLP as default.

---

## 10. Implementation Order

1. **Phase 1: Core extraction** -- Gemini setup, photo upload, single invoice extraction, structured output
2. **Phase 2: Excel/CSV** -- File parsing, batch categorization, mapping to app categories
3. **Phase 3: UX polish** -- Preview/confirm UI, confidence indicators, manual correction
4. **Phase 4 (optional): Fallback** -- Groq integration, rate limit handling

---

## Sources

- [Firebase AI Logic - Analyze Images](https://firebase.google.com/docs/ai-logic/analyze-images)
- [Firebase AI Logic - Get Started](https://firebase.google.com/docs/ai-logic/get-started)
- [Firebase AI Logic - Structured Output](https://firebase.google.com/docs/ai-logic/generate-structured-output)
- [Gemini API - Structured Output](https://ai.google.dev/gemini-api/docs/structured-output)
- [Gemini API - Free Tier Pricing](https://ai.google.dev/gemini-api/docs/pricing)
- [Gemini API - Rate Limits](https://ai.google.dev/gemini-api/docs/rate-limits)
- [Gemini for Document OCR Evaluation](https://dev.to/mayankcse/evaluating-google-gemini-for-document-ocr-using-hugging-face-invoice-dataset-567i)
- [Building Reliable Invoice Extraction Prompts](https://thomas-wiegold.com/blog/building-reliable-invoice-extraction-prompts/)
- [LlamaOCR - Invoice Processing with Llama 3.2 Vision](https://github.com/yYorky/LlamaOCR)
- [Groq - Extracting Structured Data from Images](https://medium.com/@pruthviraj0430/extracting-structured-data-from-images-with-llama-3-2-90b-vision-and-groq-apis-812c109e6700)
- [SheetJS - React Integration](https://docs.sheetjs.com/docs/demos/frontend/react/)
- [Image Preprocessing for AI Processing](https://www.buildwithmatija.com/blog/reduce-image-sizes-ai-processing-costs)
- [LLMs for Structured Data Extraction from PDFs 2026](https://unstract.com/blog/comparing-approaches-for-using-llms-for-structured-data-extraction-from-pdfs/)
- [Multi-Modal Vision vs Text-Based Parsing for Invoices](https://arxiv.org/html/2509.04469v1)
