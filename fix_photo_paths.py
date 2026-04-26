"""
One-shot backfill — adds metadata.path to every Supabase row where source='photos'.

Earlier ingest runs stored photo_uuid but not the on-disk path, so the /photo
endpoint had no way to find image bytes. This walks osxphotos once, builds a
{uuid: path} index, then UPDATEs each row.
"""
import os
from dotenv import load_dotenv
import osxphotos
from supabase import create_client

load_dotenv()

supabase = create_client(
    os.getenv("SUPABASE_URL"),
    os.getenv("SUPABASE_SERVICE_KEY"),
)


def fix_photo_paths():
    print("Loading osxphotos library...")
    photosdb = osxphotos.PhotosDB()
    # Build {uuid: path} once — single pass over the library is much faster
    # than calling photosdb.get_photo() per row.
    uuid_to_path = {p.uuid: p.path for p in photosdb.photos() if p.path}
    print(f"Indexed {len(uuid_to_path)} photos with local paths")

    print("Fetching photo rows still missing path...")
    # Filter server-side to rows without a path. Each iteration shrinks the
    # candidate set, so we re-query in a loop until empty — this also avoids
    # pagination ordering issues since we're always asking "what's left".
    updated = 0
    skipped_no_path = 0

    while True:
        page = (
            supabase.table("memories")
            .select("id, metadata")
            .eq("source", "photos")
            .is_("metadata->>path", "null")
            .limit(1000)
            .execute()
        )
        if not page.data:
            break

        progress_this_page = 0
        for row in page.data:
            metadata = row.get("metadata") or {}
            uuid = metadata.get("photo_uuid")

            path = uuid_to_path.get(uuid)
            if not path:
                # iCloud-only or removed from library. Mark it so the next
                # query doesn't keep returning the same row.
                metadata["path"] = ""
                supabase.table("memories").update({"metadata": metadata}).eq("id", row["id"]).execute()
                skipped_no_path += 1
                continue

            metadata["path"] = path
            supabase.table("memories").update({"metadata": metadata}).eq("id", row["id"]).execute()
            updated += 1
            progress_this_page += 1
            if updated % 50 == 0:
                print(f"  ...{updated} updated")

        if progress_this_page == 0 and skipped_no_path == 0:
            break

    print(f"\nDone! Updated {updated}, no local path {skipped_no_path}")


if __name__ == "__main__":
    fix_photo_paths()
