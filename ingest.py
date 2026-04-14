import os
from dotenv import load_dotenv
from notion_client import Client
from supabase import create_client
import vertexai
from vertexai.vision_models import MultiModalEmbeddingModel

load_dotenv()

# Connect to all services
notion = Client(auth=os.getenv("NOTION_API_KEY"))
supabase = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_SERVICE_KEY"))
vertexai.init(project=os.getenv("GCP_PROJECT_ID"), location=os.getenv("GCP_LOCATION"))

# Load multimodal model — supports text, image, video, audio in one vector space
model = MultiModalEmbeddingModel.from_pretrained("multimodalembedding@001")

def embed_text(text):
    # Embed text — returns a 1408-dim vector
    return model.get_embeddings(contextual_text=text).text_embedding

def get_all_notion_pages():
    # Fetch all pages, handling Notion's pagination
    results, cursor = [], None
    while True:
        response = notion.search(filter={"property": "object", "value": "page"}, start_cursor=cursor)
        results.extend(response["results"])
        if not response["has_more"]: break
        cursor = response["next_cursor"]
    print(f"Found {len(results)} Notion pages")
    return results

def get_page_text(page_id):
    # Pull plain text out of every block on the page
    blocks = notion.blocks.children.list(block_id=page_id)
    parts = []
    for block in blocks["results"]:
        for segment in block.get(block["type"], {}).get("rich_text", []):
            parts.append(segment.get("plain_text", ""))
    return " ".join(parts)

def get_page_title(page):
    # Notion pages can store titles under different property names
    for key in ["title", "Title", "Name"]:
        parts = page.get("properties", {}).get(key, {}).get("title", [])
        if parts: return parts[0].get("plain_text", "Untitled")
    return "Untitled"

def chunk_text(text, chunk_size=900, overlap=100):
    # Split by characters — multimodal model has a hard 1024 char limit per call
    chunks, start = [], 0
    while start < len(text):
        chunk = text[start:start + chunk_size]
        if chunk.strip(): chunks.append(chunk)
        start += chunk_size - overlap
    return chunks

def save_to_db(source, title, content, url, embedding):
    # Insert one chunk + its vector into the memories table
    supabase.table("memories").insert({
        "source": source, "title": title,
        "content": content, "url": url, "embedding": embedding
    }).execute()

def ingest_notion():
    for page in get_all_notion_pages():
        title = get_page_title(page)
        content = get_page_text(page["id"])
        print(f"Processing: {title}")
        if not content.strip():
            print("  Skipping (empty)"); continue
        for i, chunk in enumerate(chunk_text(content)):
            save_to_db("notion", title, chunk, page.get("url", ""), embed_text(chunk))
            print(f"  Chunk {i+1} saved")
    print("Done!")

if __name__ == "__main__":
    ingest_notion()