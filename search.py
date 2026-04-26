import io
import json
import os
import tempfile
from dotenv import load_dotenv
from fastapi import FastAPI, UploadFile, File, Response, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from PIL import Image as PILImage
import pillow_heif
from supabase import create_client
import vertexai
from vertexai.vision_models import MultiModalEmbeddingModel
import anthropic
from openai import OpenAI
from elevenlabs import ElevenLabs

load_dotenv()

# Teach Pillow to read HEIC so /photo can transcode iPhone photos to JPEG.
pillow_heif.register_heif_opener()

# Connect to all services
supabase = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_SERVICE_KEY"))
vertexai.init(project=os.getenv("GCP_PROJECT_ID"), location=os.getenv("GCP_LOCATION"))
model = MultiModalEmbeddingModel.from_pretrained("multimodalembedding@001")
claude = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
openai_client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
elevenlabs_client = ElevenLabs(api_key=os.getenv("ELEVENLABS_API_KEY"))

app = FastAPI()

# Allow the frontend to call this API from the browser
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

class Query(BaseModel):
    text: str          # the search query from the user
    source: str | None = None  # optional source filter: 'photos', 'notion', 'gmail', 'gcal', or None

class SpeakRequest(BaseModel):
    text: str  # answer text to be spoken


def detect_source(query_text: str) -> str | None:
    """
    Ask Claude to classify which memory source this query is targeting.
    Used for voice queries where there's no sidebar to click.
    Returns a source string or None (meaning search all sources).
    """
    response = claude.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=10,
        system="""Classify which memory source this query is targeting.
Reply with exactly one word: photos, notion, gmail, gcal, or all.

Default to 'all' when in doubt — most queries about a day, place,
trip, or event are better served by both photos AND notes together,
not photos alone.

Use 'photos' ONLY when the query explicitly asks for images, e.g.
"show me photos of X", "pictures from Y", "find images of Z".
Use 'notion' for: knowledge, learnings, notes, projects, ideas, things I wrote.
Use 'gmail' for: emails, messages, conversations with people.
Use 'gcal' for: calendar, schedule, events, meetings, what I have planned.
Use 'all' for everything else — including day/place/event queries
like "what did I do in Montreal" or "the alps trip".""",
        messages=[{"role": "user", "content": query_text}]
    )
    result = response.content[0].text.strip().lower()
    # Only return a specific source — 'all' means no filter
    return result if result in ("photos", "notion", "gmail", "gcal") else None


@app.post("/search")
def search(query: Query):
    # Step 1 — embed the query using the same model we used for ingestion
    embedding = model.get_embeddings(contextual_text=query.text).text_embedding

    # Step 2 — determine which source to search
    # Explicit sidebar selection takes priority over auto-detection
    # Auto-detection handles voice queries where no sidebar is clicked
    effective_source = query.source or detect_source(query.text)
    print(f"[search] query='{query.text}' explicit={query.source} detected={effective_source}")

    # Step 3 — find the most similar chunks in Supabase
    # When a source is specified, fetch a much wider window. Reason:
    # text→text similarities (notion) are naturally far higher than
    # text→image similarities (photos), so a global top-8 is dominated
    # by notion and the post-filter to source="photos" returns []. With
    # 200 rows we have enough headroom for photos to make the cut.
    match_count = 200 if effective_source else 8
    results = supabase.rpc("match_memories", {
        "query_embedding": embedding,
        "match_count": match_count
    }).execute()

    if effective_source:
        # Filter to the detected/selected source only — no similarity
        # threshold. Text→image scores naturally land in 0.05–0.20, so
        # any threshold drops valid hits. The relative ranking is still
        # meaningful, so just take the top 5 by similarity.
        sources = [s for s in results.data if s["source"] == effective_source][:5]
    else:
        # All sources — apply similarity threshold to filter weak matches
        sources = [s for s in results.data if s["similarity"] > 0.35][:5]

    # Diagnostic — confirm how many rows came back vs. survived the filter
    print(
        f"[search] returned={len(results.data)} "
        f"after_filter={len(sources)} "
        f"first={sources[0].get('title') if sources else None}"
    )

    # Step 4 — ask Claude to judge which chunks are actually relevant
    # This prevents hallucinated connections between weakly related chunks
    filter_response = claude.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=256,
        system="You are a relevance judge. Given a question and retrieved memory chunks, return a JSON array of indices (0-based) for chunks that directly help answer the question. Be strict — only include chunks that genuinely contain relevant information. Return ONLY a JSON array like [0, 2, 4] and nothing else.",
        messages=[{
            "role": "user",
            "content": f"Question: {query.text}\n\nChunks:\n" + "\n".join([
                f"[{i}] {s['title']}: {s['content'] or 'photo/image'}"
                for i, s in enumerate(sources)
            ])
        }]
    )

    # Parse the relevant indices — fall back to all sources if parsing fails
    try:
        relevant_indices = json.loads(filter_response.content[0].text)
        filtered_sources = [sources[i] for i in relevant_indices if i < len(sources)]
    except Exception:
        # If Claude returns something unparseable, use all sources as fallback
        filtered_sources = sources

    # For photo-only queries skip the relevance filter — every result is
    # a photo and we want to show them all ranked by similarity
    if effective_source == "photos":
        filtered_sources = sources

    # Step 5 — build context string from the filtered chunks
    context = "\n\n".join([
        f"[{s['source'].upper()}] {s['title']}\n{s['content'] or 'image'}"
        for s in filtered_sources
    ])

    # Step 6 — synthesize an answer.
    # For photo-only queries, the context is just filenames + "image"
    # markers, so Claude can't say anything useful — the photos themselves
    # are the answer. Skip the LLM call and return a deterministic line.
    if effective_source == "photos" and filtered_sources:
        plural = "s" if len(filtered_sources) != 1 else ""
        answer = f"Found {len(filtered_sources)} photo{plural} matching '{query.text}'."
    else:
        response = claude.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=1024,
            system="You are Jarvis, a personal AI second brain. Answer the user's question using only the context provided. Be concise and direct. If the context doesn't contain the answer, say so honestly rather than speculating.",
            messages=[{
                "role": "user",
                "content": f"Context from my second brain:\n\n{context}\n\nQuestion: {query.text}"
            }]
        )
        answer = response.content[0].text

    # Return synthesized answer + filtered sources for the frontend to render
    return {
        "answer": answer,
        "sources": filtered_sources
    }


@app.get("/photo/{uuid}")
def get_photo(uuid: str):
    # Look up the photo row by uuid stored in metadata
    row = (
        supabase.table("memories")
        .select("metadata")
        .eq("source", "photos")
        .eq("metadata->>photo_uuid", uuid)
        .limit(1)
        .execute()
    )
    if not row.data:
        raise HTTPException(status_code=404, detail="photo not found")

    path = (row.data[0].get("metadata") or {}).get("path")
    if not path or not os.path.exists(path):
        # iCloud-only photos and rows missing path land here
        raise HTTPException(status_code=404, detail="photo file unavailable")

    # HEIC isn't browser-decodable — transcode to JPEG in memory
    # Other formats (JPEG, PNG) get returned as-is
    if path.lower().endswith((".heic", ".heif")):
        img = PILImage.open(path).convert("RGB")
        buffer = io.BytesIO()
        img.save(buffer, format="JPEG", quality=85)
        return Response(content=buffer.getvalue(), media_type="image/jpeg")

    with open(path, "rb") as f:
        data = f.read()
    ext = os.path.splitext(path)[1].lower()
    media_type = "image/png" if ext == ".png" else "image/jpeg"
    return Response(content=data, media_type=media_type)


@app.post("/transcribe")
async def transcribe(audio: UploadFile = File(...)):
    # Read the audio bytes from the upload
    audio_bytes = await audio.read()

    # Write to a temp file — Whisper needs a file-like object with a name
    with tempfile.NamedTemporaryFile(suffix=".webm", delete=False) as tmp:
        tmp.write(audio_bytes)
        tmp_path = tmp.name

    # Send to Whisper for transcription
    with open(tmp_path, "rb") as f:
        result = openai_client.audio.transcriptions.create(
            model="whisper-1",
            file=f
        )

    os.unlink(tmp_path)
    return {"text": result.text}


@app.post("/speak")
def speak(req: SpeakRequest):
    print(f"[speak] called, text length: {len(req.text)}")
    print(f"[speak] voice_id={os.getenv('ELEVENLABS_VOICE_ID')}")
    try:
        # Collect all chunks into a buffer before responding
        # More reliable than StreamingResponse for CORS
        audio_chunks = []
        for chunk in elevenlabs_client.text_to_speech.stream(
            voice_id=os.getenv("ELEVENLABS_VOICE_ID"),
            text=req.text,
            model_id="eleven_turbo_v2_5"  # fastest model as of 2025
        ):
            if chunk:
                audio_chunks.append(chunk)
        audio_bytes = b"".join(audio_chunks)
        print(f"[speak] done, {len(audio_bytes)} bytes")
        return Response(content=audio_bytes, media_type="audio/mpeg")
    except Exception as e:
        print(f"[speak] ERROR ({type(e).__name__}): {e}")
        return JSONResponse({"error": f"{type(e).__name__}: {e}"}, status_code=500)