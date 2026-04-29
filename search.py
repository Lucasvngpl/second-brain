import base64
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


def analyze_query(query_text: str) -> dict:
    """One Claude call that turns a natural-language query into a search plan:

      source       — which memory source to filter to (or 'all')
      embed_query  — the *information need*, stripped of conversational
                     framing. This is what gets embedded — much better
                     semantic recall than embedding the raw verbose query.
      keywords     — proper nouns / rare terms that semantic search misses
                     (e.g. "Japan", "Vietnam"). Used for an ilike pass.

    Returns a safe default dict on any error so the search path keeps working.
    """
    try:
        response = claude.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=200,
            system="""You analyze a user's natural-language query against their
personal second brain (Notion, Apple Notes, Photos, Gmail, Calendar) and
return a search plan as JSON.

Return ONLY a JSON object — no prose, no code fences — with these fields:

"source": one of "photos", "notion", "apple_notes", "gmail", "gcal", or "all".
  - "photos" only when the query explicitly asks for images
    ("show me photos of X", "pictures from Y").
  - "notion" for written knowledge/learnings/projects/ideas.
  - "apple_notes" for personal journal entries, trip summaries, memories,
    personal lists — diary-style content. Examples:
    "best days of my life", "what did I write about Vietnam",
    "my college memories" → apple_notes.
  - "gmail" for emails/messages/conversations.
  - "gcal" for calendar/schedule/events/meetings.
  - "all" otherwise — including ambiguous trip/place queries like
    "Japan trip" or "what did I do in Montreal" where both written
    notes and photos are useful.

"embed_query": short phrase (≤ 8 words) that captures the information
  need, stripped of conversational framing like "hey tell me about" or
  "can you remind me". This is what gets embedded for semantic search.
  Examples:
    "Hey tell me about that one time I was in Japan and how that was"
      → "Japan trip experience"
    "what advice have I written down for myself"
      → "personal advice and lessons"
    "best days of my life ever" → "best days memories"
    "tell me about my Vietnam trip" → "Vietnam trip"

"keywords": list of literal proper nouns or rare/specific terms from
  the query that semantic search would miss. These drive a substring
  search to complement the embedding. Empty list if none.
  Examples:
    "tell me about my Japan trip" → ["Japan"]
    "what did I write about Vietnam" → ["Vietnam"]
    "best days of my life" → []
    "my Costa Rica vacation" → ["Costa Rica"]
    "JPEGMAFIA samples" → ["JPEGMAFIA"]""",
            messages=[{"role": "user", "content": query_text}]
        )
        # Strip markdown code fences in case Claude ignores the "no fences"
        # instruction and wraps the JSON in ```json ... ``` blocks.
        raw = response.content[0].text.strip()
        if raw.startswith("```"):
            raw = raw.strip("`")
            if raw.lower().startswith("json"):
                raw = raw[4:]
            raw = raw.strip()
        plan = json.loads(raw)
        # Normalize: 'all' → None for the source filter; coerce missing fields.
        if plan.get("source") == "all":
            plan["source"] = None
        if plan.get("source") not in (None, "photos", "notion", "apple_notes", "gmail", "gcal"):
            plan["source"] = None
        plan.setdefault("embed_query", query_text)
        plan.setdefault("keywords", [])
        return plan
    except Exception as e:
        # Log what Claude actually returned so we can see why parse died
        # next time (empty body, trailing prose, etc).
        raw_preview = locals().get("raw", "<no response>")
        print(f"[analyze_query] failed: {type(e).__name__}: {e} | raw={raw_preview!r}")
        return {"source": None, "embed_query": query_text, "keywords": []}


def caption_top_photo(query_text: str, photo_url: str) -> str | None:
    """Show Claude (vision) the top-matching photo and return a one-
    sentence observation that addresses the user's question. Used when
    the text bucket is empty in mixed mode — instead of a hand-wringing
    'I can't answer' from text-only synthesis, Claude actually looks at
    the photo. Returns None on any failure so the caller can fall back."""
    try:
        # url is stored as "photos://{uuid}" by the photos ingester;
        # look up the file path the same way the /photo endpoint does
        uuid = photo_url.split("photos://", 1)[-1]
        row = (
            supabase.table("memories")
            .select("metadata")
            .eq("source", "photos")
            .eq("metadata->>photo_uuid", uuid)
            .limit(1)
            .execute()
        )
        if not row.data:
            return None
        path = (row.data[0].get("metadata") or {}).get("path")
        if not path or not os.path.exists(path):
            return None

        # Claude vision accepts jpeg/png/gif/webp — transcode HEIC like /photo
        if path.lower().endswith((".heic", ".heif")):
            img = PILImage.open(path).convert("RGB")
            buf = io.BytesIO()
            img.save(buf, format="JPEG", quality=85)
            image_bytes = buf.getvalue()
            media_type = "image/jpeg"
        else:
            with open(path, "rb") as f:
                image_bytes = f.read()
            ext = os.path.splitext(path)[1].lower()
            media_type = "image/png" if ext == ".png" else "image/jpeg"

        b64 = base64.standard_b64encode(image_bytes).decode("utf-8")

        response = claude.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=120,
            system=(
                "You are Jarvis, the user's personal AI second brain. The "
                "user typed a search query — it might be a question, but it's "
                "often just keywords or a noun phrase ('warriors basketball', "
                "'paris trip'). The best match in their library is the photo "
                "shown. Reply in one short, natural sentence describing what "
                "you actually see, framed as 'here's what I found' rather "
                "than answering a question. Address the user directly "
                "('Looks like you were at...', 'Found a shot of...'). "
                "Don't say 'this image' or 'the photo' — just describe the moment."
            ),
            messages=[{
                "role": "user",
                "content": [
                    {"type": "image", "source": {"type": "base64", "media_type": media_type, "data": b64}},
                    {"type": "text", "text": f"Search query: {query_text}"}
                ]
            }]
        )
        return response.content[0].text.strip()
    except Exception as e:
        print(f"[caption_top_photo] failed: {type(e).__name__}: {e}")
        return None


@app.post("/search")
def search(query: Query):
    # Step 1 — analyze the query: distill the information need, identify
    # proper-noun keywords for hybrid search, classify which source to hit.
    plan = analyze_query(query.text)
    embed_query = plan["embed_query"]
    keywords = plan["keywords"]

    # Step 2 — embed the *distilled* phrase, not the raw conversational text.
    # Embedding "Japan trip experience" instead of "hey tell me about that
    # one time I was in Japan" gives much sharper semantic recall.
    embedding = model.get_embeddings(contextual_text=embed_query).text_embedding

    # Step 3 — determine which source to search.
    # Explicit sidebar selection wins; otherwise use the LLM's classification.
    effective_source = query.source or plan["source"]
    print(f"[search] q='{query.text}' embed='{embed_query}' kw={keywords} source={effective_source}")

    # Step 3 — find the most similar chunks in Supabase
    # Wide window because text→text similarities sit at 0.4–0.7 while
    # text→image lands at 0.05–0.20. With ~385 text chunks in corpus, a
    # top-200 window is entirely text and photos never surface. 1000 leaves
    # comfortable headroom for both modalities to make the candidate pool.
    results = supabase.rpc("match_memories", {
        "query_embedding": embedding,
        "match_count": 1000
    }).execute()

    if effective_source:
        # Filter to the detected/selected source only — no similarity
        # threshold. Text→image scores naturally land in 0.05–0.20, so
        # any threshold drops valid hits. Take top 15 (not top 5) so
        # genuinely relevant chunks that rank ~10th by similarity still
        # reach the relevance judge — the judge filters strictly anyway.
        sources = [s for s in results.data if s["source"] == effective_source][:15]

        # Hybrid pass — embeddings encode vibe, not literal substrings,
        # so proper-noun queries like "Japan" miss the chunk that actually
        # contains the word. The LLM extracted the proper nouns above; pull
        # ilike matches and merge into the candidate pool for the judge.
        if keywords:
            seen = {(s["source"], s["url"], s["content"]) for s in sources}
            for kw in keywords[:3]:
                rows = (
                    supabase.table("memories")
                    .select("source, title, content, url")
                    .eq("source", effective_source)
                    .ilike("content", f"%{kw}%")
                    .limit(5)
                    .execute()
                    .data
                )
                for row in rows:
                    key = (row["source"], row["url"], row["content"])
                    if key in seen:
                        continue
                    seen.add(key)
                    row["similarity"] = 0.0  # no semantic score; judge will rank
                    sources.append(row)
    else:
        # Mixed mode — split by modality so photos aren't drowned out by
        # text. A single threshold can't serve both: 0.35 kills every photo,
        # 0.0 lets weak text through. So filter each bucket separately and
        # merge: top 3 text (threshold-filtered) + top 3 photos (rank-only).
        text_results = [
            s for s in results.data
            if s["source"] != "photos" and s["similarity"] > 0.35
        ][:3]
        photo_results = [
            s for s in results.data if s["source"] == "photos"
        ][:3]
        sources = text_results + photo_results

        # Hybrid keyword pass — same idea as the source-specific branch but
        # spans all text sources. Photos have null content so ilike matches
        # nothing for them; they still surface via the embedding bucket above.
        if keywords:
            seen = {(s["source"], s["url"], s["content"]) for s in sources}
            for kw in keywords[:3]:
                rows = (
                    supabase.table("memories")
                    .select("source, title, content, url")
                    .neq("source", "photos")
                    .ilike("content", f"%{kw}%")
                    .limit(5)
                    .execute()
                    .data
                )
                for row in rows:
                    key = (row["source"], row["url"], row["content"])
                    if key in seen:
                        continue
                    seen.add(key)
                    row["similarity"] = 0.0
                    sources.append(row)

    # Diagnostic — confirm how many rows came back vs. survived the filter
    print(
        f"[search] returned={len(results.data)} "
        f"after_filter={len(sources)} "
        f"first={sources[0].get('title') if sources else None}"
    )

    # Step 4 — ask Claude which text chunks are actually relevant.
    # Photos always pass through unfiltered (their content is empty so the
    # judge would unfairly drop them); we only judge text-bearing chunks.
    text_for_judge = [s for s in sources if s["source"] != "photos"]
    photo_passthrough = [s for s in sources if s["source"] == "photos"]

    if not text_for_judge:
        # Nothing to judge (photos-only mode, or mixed mode where no text
        # passed the threshold)
        relevant_text = []
    else:
        filter_response = claude.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=256,
            system="You are a relevance judge. Given a query and retrieved memory chunks, return a JSON array of indices (0-based) for chunks that directly help answer or address the query. Be strict — only include chunks that genuinely contain relevant information. Return ONLY a JSON array like [0, 2, 4] and nothing else.",
            messages=[{
                "role": "user",
                "content": f"Query: {query.text}\n\nChunks:\n" + "\n".join([
                    f"[{i}] {s['title']}: {s['content'] or ''}"
                    for i, s in enumerate(text_for_judge)
                ])
            }]
        )
        try:
            relevant_indices = json.loads(filter_response.content[0].text)
            relevant_text = [text_for_judge[i] for i in relevant_indices if i < len(text_for_judge)]
        except Exception:
            # Unparseable response — keep all text candidates as a safe fallback
            relevant_text = text_for_judge

    # Dedup judged chunks to one-per-document so the frontend doesn't show
    # multiple cards for the same note when several of its chunks rank high.
    seen_urls = set()
    unique_relevant = []
    for r in relevant_text:
        key = (r["source"], r.get("url", ""))
        if key in seen_urls:
            continue
        seen_urls.add(key)
        unique_relevant.append(r)

    filtered_sources = unique_relevant + photo_passthrough

    # Expand each approved document to ALL its chunks for synthesis context.
    # A note chunked into 15 pieces often has only 1 chunk pass the judge —
    # feeding synthesis the whole note (instead of a fragment) turns
    # "I can only see a fragment" into a complete answer.
    # Group urls by source and run ONE in_() query per source instead of
    # N sequential queries — the sequential pattern was tripping HTTP/2
    # connection resets at ~15 candidates.
    by_source: dict[str, list[str]] = {}
    expanded_text = []
    for r in unique_relevant:
        if r.get("url"):
            by_source.setdefault(r["source"], []).append(r["url"])
        else:
            expanded_text.append(r)
    for src, urls in by_source.items():
        rows = (
            supabase.table("memories")
            .select("source, title, content, url")
            .eq("source", src)
            .in_("url", urls)
            .order("id")
            .execute()
            .data
        )
        expanded_text.extend(rows)
    context_sources = expanded_text + photo_passthrough

    # Step 5 — synthesize an answer. Three modes:
    # - source=photos: deterministic line (the photos speak for themselves)
    # - mixed mode with no relevant text: use vision on the top photo so
    #   Jarvis says something genuine instead of "I can't answer"
    # - everything else: synthesize from the text context
    if effective_source == "photos" and filtered_sources:
        plural = "s" if len(filtered_sources) != 1 else ""
        answer = f"Found {len(filtered_sources)} photo{plural} matching '{query.text}'."
    elif not relevant_text and photo_passthrough:
        caption = caption_top_photo(query.text, photo_passthrough[0]["url"])
        if caption:
            answer = caption
        else:
            plural = "s" if len(photo_passthrough) != 1 else ""
            answer = f"Found {len(photo_passthrough)} photo{plural} matching '{query.text}'."
    elif filtered_sources:
        context = "\n\n".join([
            f"[{s['source'].upper()}] {s['title']}\n{s['content'] or 'image'}"
            for s in context_sources
        ])
        # If photos came back alongside the text, hint the synthesizer to
        # mention them naturally at the end so the spoken answer cues the
        # user to glance at the photo grid.
        photo_count = len(photo_passthrough)
        photo_hint = (
            f"\n\nNote: {photo_count} photo{'s' if photo_count != 1 else ''} "
            "from this memory also surfaced — mention them briefly at the end "
            "in a natural way (e.g. 'I also pulled up a few photos from that') "
            "so the user knows to glance at the panel."
            if photo_count > 0 else ""
        )
        response = claude.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=1024,
            system="You are Jarvis, a personal AI second brain. Answer the user's question using only the context provided. Speak in a natural, conversational chill and cool voice, not bullet lists or section headers. If the context doesn't contain the answer, say so honestly rather than speculating.",
            messages=[{
                "role": "user",
                "content": f"Context from my second brain:\n\n{context}\n\nQuestion: {query.text}{photo_hint}"
            }]
        )
        answer = response.content[0].text
    else:
        answer = "Couldn't find anything matching your query."

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