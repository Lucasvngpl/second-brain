"""
Diagnostic — figure out why photo search keeps returning IMG_3599 + IMG_5769
for every query, regardless of what the user types.

Read-only. Writes nothing to Supabase. Prints everything to stdout so you
can paste the output back for analysis.

Mirrors search.py's exact embed/RPC pattern so results are directly comparable.
"""
import json
import math
import os
import random
from collections import Counter

from dotenv import load_dotenv
from supabase import create_client
import vertexai
from vertexai.vision_models import MultiModalEmbeddingModel

load_dotenv()

# Same setup as search.py (lines 25-27) so the diagnostic matches prod behaviour.
supabase = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_SERVICE_KEY"))
vertexai.init(project=os.getenv("GCP_PROJECT_ID"), location=os.getenv("GCP_LOCATION"))
model = MultiModalEmbeddingModel.from_pretrained("multimodalembedding@001")

QUERIES = [
    "sushi food",
    "fancy restaurant red ceiling lights",
    "family dinner restaurant",
]
SUSPECT_TITLES = {"IMG_3599.HEIC", "IMG_5769.HEIC", "IMG_3599", "IMG_5769"}


def parse_embedding(raw):
    """Supabase returns vector columns as JSON-ish strings — turn into list[float]."""
    if raw is None:
        return None
    if isinstance(raw, list):
        return raw
    return json.loads(raw)


def vec_stats(vec):
    """Quick L2 norm + range so we can spot anomalies (NaN, zero, huge norm)."""
    if vec is None:
        return {"len": None, "norm": None, "min": None, "max": None, "nan": None}
    nan_count = sum(1 for x in vec if x != x)  # NaN ≠ itself
    norm = math.sqrt(sum((x * x) for x in vec if x == x))
    return {
        "len": len(vec),
        "norm": round(norm, 4),
        "min": round(min(vec), 4),
        "max": round(max(vec), 4),
        "nan": nan_count,
    }


def section(title):
    print("\n" + "=" * 78)
    print(title)
    print("=" * 78)


# ---------------------------------------------------------------------------
section("1. Top-10 photos per query (via match_memories RPC)")
# ---------------------------------------------------------------------------
suspect_hits = {q: [] for q in QUERIES}

for q in QUERIES:
    print(f"\n--- query: {q!r}")
    emb = model.get_embeddings(contextual_text=q).text_embedding

    rpc = supabase.rpc(
        "match_memories",
        {"query_embedding": emb, "match_count": 200},
    ).execute()

    photos = [r for r in rpc.data if r.get("source") == "photos"]
    total_returned = len(rpc.data)
    photos_in_topN = len(photos)

    print(f"    rpc returned {total_returned} rows · {photos_in_topN} photos")
    if not photos:
        print("    (no photos in top 200 — text→image scores too low to make the cut)")
        continue

    for rank, row in enumerate(photos[:10], start=1):
        title = row.get("title", "")
        sim = row.get("similarity", 0.0)
        marker = "  <-- SUSPECT" if title in SUSPECT_TITLES else ""
        print(f"    {rank:>2}. sim={sim:>7.4f}  {title}{marker}")
        if title in SUSPECT_TITLES:
            suspect_hits[q].append((rank, sim, title))


# ---------------------------------------------------------------------------
section("2. Did suspects dominate every query?")
# ---------------------------------------------------------------------------
for q in QUERIES:
    hits = suspect_hits[q]
    if hits:
        for rank, sim, title in hits:
            print(f"    {q!r:50}  rank={rank:<2}  sim={sim:.4f}  {title}")
    else:
        print(f"    {q!r:50}  (no suspect in top 10 — interesting)")


# ---------------------------------------------------------------------------
section("3. Duplicate photo_uuid check")
# ---------------------------------------------------------------------------
# supabase-py can't run GROUP BY through PostgREST. Pull every photo row's
# uuid + title and count in Python. ~3k rows is trivial.
all_photos = []
page_size = 1000
offset = 0
while True:
    page = (
        supabase.table("memories")
        .select("title,metadata")
        .eq("source", "photos")
        .range(offset, offset + page_size - 1)
        .execute()
    )
    if not page.data:
        break
    all_photos.extend(page.data)
    if len(page.data) < page_size:
        break
    offset += page_size

print(f"    fetched {len(all_photos)} photo rows total")

uuid_counts = Counter(
    (r.get("metadata") or {}).get("photo_uuid") for r in all_photos
)
title_counts = Counter(r.get("title") for r in all_photos)

dup_uuids = [(u, c) for u, c in uuid_counts.most_common(10) if c > 1 and u]
dup_titles = [(t, c) for t, c in title_counts.most_common(10) if c > 1 and t]

print("\n    top duplicate photo_uuid (count > 1):")
if dup_uuids:
    for uuid, count in dup_uuids:
        print(f"      {count:>3}x  {uuid}")
else:
    print("      (none — uuid is unique per row)")

print("\n    top duplicate titles (count > 1, just for context — same filename can repeat):")
if dup_titles:
    for title, count in dup_titles[:10]:
        marker = "  <-- SUSPECT" if title in SUSPECT_TITLES else ""
        print(f"      {count:>3}x  {title}{marker}")
else:
    print("      (none)")

null_uuid = sum(1 for r in all_photos if not (r.get("metadata") or {}).get("photo_uuid"))
print(f"\n    rows missing photo_uuid in metadata: {null_uuid}")


# ---------------------------------------------------------------------------
section("4. Embedding sanity — IMG_3599, IMG_5769, plus 20 random photos")
# ---------------------------------------------------------------------------
# Pull suspects directly by title.
suspects = (
    supabase.table("memories")
    .select("id,title,embedding,metadata")
    .eq("source", "photos")
    .in_("title", list(SUSPECT_TITLES))
    .execute()
)

print(f"\n    suspect rows (matched by title in {SUSPECT_TITLES}): {len(suspects.data)}")
for row in suspects.data:
    vec = parse_embedding(row.get("embedding"))
    stats = vec_stats(vec)
    uuid = (row.get("metadata") or {}).get("photo_uuid", "?")
    print(f"      {row.get('title'):20}  uuid={uuid[:8]}  {stats}")

# Random sample of other photos for comparison.
random.seed(42)
non_suspect = [r for r in all_photos if r.get("title") not in SUSPECT_TITLES]
sample_titles = [r.get("title") for r in random.sample(non_suspect, min(20, len(non_suspect)))]
sample = (
    supabase.table("memories")
    .select("title,embedding")
    .eq("source", "photos")
    .in_("title", sample_titles)
    .limit(20)
    .execute()
)

print("\n    20 random photos (for baseline norms — Vertex output should be ~1.0):")
for row in sample.data:
    vec = parse_embedding(row.get("embedding"))
    stats = vec_stats(vec)
    print(f"      {(row.get('title') or '')[:25]:25}  {stats}")


# ---------------------------------------------------------------------------
section("5. Corpus health")
# ---------------------------------------------------------------------------
# Count rows with NULL embedding (bad ingest) vs. populated.
all_count = (
    supabase.table("memories")
    .select("id", count="exact")
    .eq("source", "photos")
    .execute()
)
null_emb = (
    supabase.table("memories")
    .select("id", count="exact")
    .eq("source", "photos")
    .is_("embedding", "null")
    .execute()
)
print(f"    total photo rows in DB:        {all_count.count}")
print(f"    photo rows with NULL embedding: {null_emb.count}")


# ---------------------------------------------------------------------------
section("6. NEXT STEP — paste the match_memories SQL here")
# ---------------------------------------------------------------------------
print("""
    Open Supabase Dashboard → Database → Functions → match_memories
    and paste the body back, OR run this in the SQL Editor:

        SELECT pg_get_functiondef(oid)
        FROM pg_proc
        WHERE proname = 'match_memories';

    What we're checking: cosine operator (<=>), correct ORDER BY direction,
    the (1 - distance) similarity formula, and that source filtering isn't
    silently applied inside the function.
""")
