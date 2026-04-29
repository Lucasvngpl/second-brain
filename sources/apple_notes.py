import os
import re
import html
import time
import subprocess
from dotenv import load_dotenv
from supabase import create_client
import vertexai
from vertexai.vision_models import MultiModalEmbeddingModel

load_dotenv()

# Connect to Supabase + Vertex AI — same setup as Notion ingest.
supabase = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_SERVICE_KEY"))
vertexai.init(project=os.getenv("GCP_PROJECT_ID"), location=os.getenv("GCP_LOCATION"))
model = MultiModalEmbeddingModel.from_pretrained("multimodalembedding@001")


# AppleScript that dumps every note as field-delimited text.
# \x1f (Unit Separator) between fields, \x1e (Record Separator) between notes
# — these bytes never appear in note content, so the Python side can split safely.
NOTES_DUMP_SCRIPT = '''
set output to ""
set fieldSep to character id 31
set recSep to character id 30
tell application "Notes"
    repeat with n in every note
        set output to output & (id of n) & fieldSep & (name of n) & fieldSep & ((modification date of n) as «class isot» as string) & fieldSep & (body of n) & recSep
    end repeat
end tell
return output
'''


def get_all_notes():
    # One osascript call returns the whole library, delimiter-separated.
    result = subprocess.run(
        ["osascript", "-e", NOTES_DUMP_SCRIPT],
        capture_output=True, text=True, check=True,
    )
    notes = []
    for record in result.stdout.split("\x1e"):
        if not record.strip():
            continue
        # Cap split at 3 so an in-body \x1f byte stays in the body field
        # rather than spilling out as a 5th part.
        parts = record.split("\x1f", 3)
        if len(parts) < 4:
            continue
        note_id, title, mod_date, body = parts[:4]
        notes.append({
            "id": note_id.strip(),
            "title": title.strip() or "Untitled",
            "modification_date": mod_date.strip(),
            "body": body,
        })
    print(f"Found {len(notes)} Apple Notes")
    return notes


def html_to_text(body_html):
    # Apple Notes stores body as HTML — strip tags, decode entities, collapse whitespace.
    text = re.sub(r"<[^>]+>", " ", body_html)
    text = html.unescape(text)
    return re.sub(r"\s+", " ", text).strip()


def chunk_text(text, chunk_size=900, overlap=100):
    # Split by characters — multimodal model has a hard 1024 char limit per call.
    chunks, start = [], 0
    while start < len(text):
        chunk = text[start:start + chunk_size]
        if chunk.strip(): chunks.append(chunk)
        start += chunk_size - overlap
    return chunks


def embed_text(text):
    # Embed text — returns a 1408-dim vector.
    return model.get_embeddings(contextual_text=text).text_embedding


def ingest_apple_notes(limit=None):
    # Load already-ingested note IDs once upfront — mirrors photos.py pattern.
    # PostgREST returns `metadata->>note_id` under the key `note_id` in the response
    # (last accessor wins), so we read `row["note_id"]`, not the full path.
    print("Loading already-ingested note IDs...")
    # Explicit limit — Supabase clients cap selects at 1000 rows by default,
    # which would silently break dedup once the apple_notes corpus grows.
    existing = supabase.table("memories").select(
        "metadata->>note_id"
    ).eq("source", "apple_notes").limit(100000).execute()
    ingested_ids = {
        row["note_id"]
        for row in existing.data
        if row.get("note_id")
    }
    print(f"Already ingested: {len(ingested_ids)} notes")

    notes = get_all_notes()
    if limit is not None:
        notes = notes[:limit]
        print(f"Processing first {limit} notes")

    success = skipped = failed = 0
    for i, note in enumerate(notes):
        try:
            if note["id"] in ingested_ids:
                skipped += 1
                continue

            content = html_to_text(note["body"])
            if not content:
                print(f"[{i+1}] Skipping (empty): {note['title']}")
                skipped += 1
                continue

            print(f"[{i+1}] Embedding: {note['title']}")

            metadata = {
                "note_id": note["id"],
                "title": note["title"],
                "modification_date": note["modification_date"],
            }

            for chunk in chunk_text(content):
                supabase.table("memories").insert({
                    "source": "apple_notes",
                    "title": note["title"],
                    "content": chunk,
                    "url": note["id"],  # x-coredata:// URL — opens in Notes.app
                    "embedding": embed_text(chunk),
                    "metadata": metadata,
                }).execute()
                # Small delay between embedding calls — same as photos.py.
                time.sleep(0.2)

            success += 1

        except Exception as e:
            print(f"  Failed: {e}")
            failed += 1
            continue

    print(f"\nDone! {success} embedded, {skipped} skipped, {failed} failed")


if __name__ == "__main__":
    # Full library — dedup via metadata->>note_id makes re-runs idempotent.
    ingest_apple_notes()
