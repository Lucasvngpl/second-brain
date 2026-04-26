import io
import os
import tempfile
import time
import osxphotos
import pillow_heif
import vertexai
from PIL import Image as PILImage
from vertexai.vision_models import MultiModalEmbeddingModel, Image
from supabase import create_client
from dotenv import load_dotenv

load_dotenv()

pillow_heif.register_heif_opener()  # teaches Pillow to read HEIC

# Connect to Supabase
supabase = create_client(
    os.getenv("SUPABASE_URL"),
    os.getenv("SUPABASE_SERVICE_KEY")
)

# Initialize Vertex AI multimodal embedding model
vertexai.init(
    project=os.getenv("GCP_PROJECT_ID"),
    location=os.getenv("GCP_LOCATION")
)
model = MultiModalEmbeddingModel.from_pretrained("multimodalembedding@001")


def embed_image(image_path: str) -> list[float]:
    """Embed a photo — converts HEIC to JPEG first if needed."""

    # Convert HEIC/HEIF to JPEG in memory before sending to Vertex
    if image_path.lower().endswith(('.heic', '.heif')):
        img = PILImage.open(image_path)
        buffer = io.BytesIO()
        img.convert('RGB').save(buffer, format='JPEG', quality=85)
        buffer.seek(0)
        # Save temp file since Vertex needs a file path
        with tempfile.NamedTemporaryFile(suffix='.jpg', delete=False) as tmp:
            tmp.write(buffer.read())
            tmp_path = tmp.name
        image = Image.load_from_file(tmp_path)
        os.unlink(tmp_path)  # clean up temp file
    else:
        image = Image.load_from_file(image_path)

    embeddings = model.get_embeddings(image=image)
    return embeddings.image_embedding




def ingest_photos(limit: int = None):
    """
    Fetch all photos from macOS Photos library, embed them,
    and save to Supabase memories table.

    limit: optional max number of photos to process (useful for testing)
    """
    # Load all already-ingested UUIDs once upfront — much faster than
    # querying Supabase individually for each of 16,000+ photos
    print("Loading already-ingested photo UUIDs...")
    existing = supabase.table("memories").select(
        "metadata->>photo_uuid"
    ).eq("source", "photos").execute()

    ingested_uuids = {
        row["metadata->>photo_uuid"]
        for row in existing.data
        if row.get("metadata->>photo_uuid")
    }
    print(f"Already ingested: {len(ingested_uuids)} photos")
    
    # Load the Photos library
    photosdb = osxphotos.PhotosDB()
    photos = photosdb.photos()

    print(f"Found {len(photos)} photos in library")

    if limit:
        photos = photos[:limit]
        print(f"Processing first {limit} photos")

    success = 0
    skipped = 0
    failed = 0

    for i, photo in enumerate(photos):
        try:
            # Skip photos without a valid file path
            if not photo.path:
                skipped += 1
                continue

            # Skip if already embedded
            if photo.uuid in ingested_uuids:
                skipped += 1
                continue

            # Build a descriptive title from available metadata
            # Use filename as fallback if no title
            title = photo.original_filename or photo.filename or "untitled"

            # Format the date nicely for display
            date_str = photo.date.strftime("%Y-%m-%d") if photo.date else ""

            print(f"[{i+1}] Embedding: {title} ({date_str})")

            # Embed the image using multimodal model
            embedding = embed_image(photo.path)

            # Build metadata — store everything useful for display.
            # `path` is needed by the /photo endpoint to serve image bytes.
            metadata = {
                "photo_uuid": photo.uuid,
                "path": photo.path,
                "filename": photo.filename,
                "original_filename": photo.original_filename,
                "date": date_str,
                "albums": photo.albums,
                "location": {
                    "latitude": photo.location[0] if photo.location else None,
                    "longitude": photo.location[1] if photo.location else None,
                },
                "width": photo.width,
                "height": photo.height,
                "favorite": photo.favorite,
            }

            # Save to Supabase — same table as Notion memories
            supabase.table("memories").insert({
                "source": "photos",
                "title": title,
                "content": None,  # photos have no text content
                "url": f"photos://{photo.uuid}",  # deep link format
                "embedding": embedding,
                "metadata": metadata
            }).execute()

            success += 1

            # Small delay to avoid hitting Vertex AI rate limits
            time.sleep(0.2)

        except Exception as e:
            print(f"  Failed: {e}")
            failed += 1
            continue

    print(f"\nDone! {success} embedded, {skipped} skipped, {failed} failed")


if __name__ == "__main__":
    # Start with a small batch to test — remove limit to run full library
    ingest_photos()
