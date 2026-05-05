import { useState } from "react"
import type { Source } from "../App"
import { T } from "./ui"

// Strips the photos:// scheme prefix that ingest stamps on the url column.
function uuidFromUrl(url: string) {
  return url.replace(/^photos:\/\//, "")
}

// Trim filename for the overlay so long names don't blow out the thumb width.
// Kit uses uppercase letterspaced monospace; mirror that.
function shortName(filename: string) {
  const stem = filename.replace(/\.[^.]+$/, "")
  return stem.length > 14 ? stem.slice(0, 14) : stem
}

// Single thumbnail — matches ScreensLight.jsx PhotoThumb chrome (rounded card,
// border, filename top-left, similarity bottom-right in orange) but with a
// real <img> instead of the kit's SVG placeholder.
function PhotoThumb({ source, onOpen }: { source: Source; onOpen: (uuid: string) => void }) {
  const uuid = uuidFromUrl(source.url)
  const sim = Math.round(source.similarity * 100)
  return (
    <div
      onClick={() => onOpen(uuid)}
      style={{
        position: "relative",
        borderRadius: 8,
        overflow: "hidden",
        border: `1px solid ${T.border}`,
        background: T.card,
        aspectRatio: "4 / 3",
        cursor: "zoom-in",
      }}
    >
      <img
        src={`http://localhost:8000/photo/${uuid}`}
        alt={source.title}
        loading="lazy"
        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
      />
      <div style={{
        position: "absolute",
        top: 6,
        left: 8,
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 8,
        letterSpacing: "0.14em",
        color: "rgba(0,0,0,0.55)",
        textTransform: "uppercase",
        fontWeight: 400,
      }}>{shortName(source.title)}</div>
      <div style={{
        position: "absolute",
        bottom: 6,
        right: 8,
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 9,
        color: T.orange,
        fontWeight: 500,
      }}>{sim}%</div>
    </div>
  )
}

// Photo grid section — "photos · N results" header followed by a 4-col grid.
// Owns its own scroll so non-photo SourceCards beneath stay docked.
export default function PhotoResults({ sources }: { sources: Source[] }) {
  // Lightbox preview — clicked thumb's uuid, or null when nothing's open.
  // Mirrors the affordance VoiceOverlay already has, so clicking a photo
  // does the same thing whether you're in voice mode or text mode.
  const [previewUuid, setPreviewUuid] = useState<string | null>(null)

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "4px 2px 0" }}>
        <span style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 9,
          letterSpacing: "0.22em",
          textTransform: "uppercase",
          color: T.text3,
          fontWeight: 400,
        }}>photos</span>
        <span style={{ color: T.mute2 }}>·</span>
        <span style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 9,
          letterSpacing: "0.22em",
          textTransform: "uppercase",
          color: T.mute,
          fontWeight: 400,
        }}>{sources.length} results</span>
      </div>
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(4, 1fr)",
        gap: 10,
      }}>
        {sources.map((s, i) => <PhotoThumb key={i} source={s} onOpen={setPreviewUuid} />)}
      </div>

      {/* Lightbox — full-window dim backdrop with the clicked image centered.
          Click the backdrop to close. */}
      {previewUuid && (
        <div
          onClick={() => setPreviewUuid(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.78)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            cursor: "zoom-out",
          }}
        >
          <img
            src={`http://localhost:8000/photo/${previewUuid}`}
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: "92vw",
              maxHeight: "92vh",
              borderRadius: 12,
              boxShadow: "0 24px 64px rgba(0, 0, 0, 0.5)",
              cursor: "default",
            }}
          />
        </div>
      )}
    </div>
  )
}
