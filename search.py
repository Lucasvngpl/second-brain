import os
import tempfile
from dotenv import load_dotenv
from fastapi import FastAPI, UploadFile, File, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from supabase import create_client
import vertexai
from vertexai.vision_models import MultiModalEmbeddingModel
import anthropic
from openai import OpenAI
from elevenlabs import ElevenLabs

load_dotenv()

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
    text: str  # the search query from the user

class SpeakRequest(BaseModel):
    text: str  # answer text to be spoken

@app.post("/search")
def search(query: Query):
    # Step 1 — embed the query using the same model we used for ingestion
    embedding = model.get_embeddings(contextual_text=query.text).text_embedding

    # Step 2 — find the most similar chunks in Supabase
    results = supabase.rpc("match_memories", {
        "query_embedding": embedding,
        "match_count": 8
    }).execute()

    sources = [s for s in results.data if s["similarity"] > 0.35][:3]  # list of matching chunks with title, content, url, source

    # Step 3 — build context string from the matching chunks
    context = "\n\n".join([
        f"[{s['source'].upper()}] {s['title']}\n{s['content']}"
        for s in sources
    ])

    # Step 4 — ask Claude to synthesize an answer from the retrieved chunks
    response = claude.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=1024,
        system="You are Jarvis, a personal AI second brain. Answer the user's question using only the context provided. Be concise and direct. If the context doesn't contain the answer, say so.",
        messages=[{
            "role": "user",
            "content": f"Context from my second brain:\n\n{context}\n\nQuestion: {query.text}"
        }]
    )

    answer = response.content[0].text

    # Return synthesized answer + raw sources for the frontend to render
    return {
        "answer": answer,
        "sources": sources
    }

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
    return { "text": result.text }

@app.post("/speak")
def speak(req: SpeakRequest):
    print(f"[speak] called, text length: {len(req.text)}")
    print(f"[speak] voice_id={os.getenv('ELEVENLABS_VOICE_ID')}")
    try:
        # Collect all chunks into a buffer before responding
        # More reliable than StreamingResponse for CORS — headers are sent once, after all bytes are ready
        audio_chunks = []
        for chunk in elevenlabs_client.text_to_speech.convert_as_stream(
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
        print(f"[speak] ERROR: {e}")
        return JSONResponse({"error": str(e)}, status_code=500)