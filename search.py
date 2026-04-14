import os
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from supabase import create_client
import vertexai
from vertexai.vision_models import MultiModalEmbeddingModel
import anthropic

load_dotenv()

# Connect to all services
supabase = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_SERVICE_KEY"))
vertexai.init(project=os.getenv("GCP_PROJECT_ID"), location=os.getenv("GCP_LOCATION"))
model = MultiModalEmbeddingModel.from_pretrained("multimodalembedding@001")
claude = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

app = FastAPI()

# Allow the frontend to call this API from the browser
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

class Query(BaseModel):
    text: str  # the search query from the user

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