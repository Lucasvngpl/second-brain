import { useState, useRef } from "react"
import { T } from "./components/ui"
import Titlebar from "./components/Titlebar.tsx"
import Sidebar from "./components/Sidebar"
import SearchBar from "./components/SearchBar.tsx"
import AnswerPanel from "./components/AnswerPanel.tsx"
import RecentPanel from "./components/RecentPanel.tsx"
import StatusBar from "./components/StatusBar.tsx"
import VoiceOverlay from "./components/VoiceOverlay.tsx"

export type Source = {
  title: string
  content: string
  source: string
  url: string
  similarity: number
}

export type SearchResult = {
  answer: string
  sources: Source[]
}

type VoiceState = 'idle' | 'listening' | 'processing' | 'speaking'

export default function App() {
  const [result, setResult] = useState<SearchResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [history, setHistory] = useState<string[]>([])
  const [activeSource, setActiveSource] = useState("all")
  const [backendOnline, setBackendOnline] = useState(true)

  // ── Voice state ─────────────────────────────────────────────────────────
  const [voiceState, setVoiceState] = useState<VoiceState>('idle')
  const [transcript, setTranscript] = useState('')
  const isVoiceQueryRef = useRef(false)  // tracks whether current search came from voice

  // Recording infrastructure refs — no re-renders needed for these
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const silenceIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)

  // ── Search ───────────────────────────────────────────────────────────────
  async function handleSearch(query: string) {
    if (!query.trim()) return
    setLoading(true)
    setHistory(prev => [query, ...prev.slice(0, 9)])

    try {
      const res = await fetch("http://localhost:8000/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: query })
      })
      const data = await res.json()
      setResult(data)
      setBackendOnline(true)

      // Speak the answer back if this query came from voice
      if (isVoiceQueryRef.current) {
        speakAnswer(data.answer)
      }
    } catch {
      setBackendOnline(false)
      setResult({ answer: "Could not reach the backend. Is it running?", sources: [] })
      setVoiceState('idle')
      isVoiceQueryRef.current = false
    }

    setLoading(false)
  }

  // ── Voice: speak answer via ElevenLabs ───────────────────────────────────
  async function speakAnswer(text: string) {
    console.log("speakAnswer called with text length:", text.length)
    setVoiceState('speaking')  // transition immediately so UI doesn't lag behind audio load

    try {
      const res = await fetch("http://localhost:8000/speak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text })
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'unknown' }))
        console.error("speak endpoint returned", res.status, err)
        setVoiceState('idle')
        isVoiceQueryRef.current = false
        return
      }

      // Read as arrayBuffer — more reliable than .blob() for audio data
      const arrayBuffer = await res.arrayBuffer()
      console.log("fetch to /speak complete, blob size:", arrayBuffer.byteLength)

      const blob = new Blob([arrayBuffer], { type: 'audio/mpeg' })
      const url = URL.createObjectURL(blob)
      const audio = new Audio(url)

      console.log("Audio created, attempting play")

      // Return to results view when audio finishes
      audio.onended = () => {
        console.log("Audio ended")
        setVoiceState('idle')
        isVoiceQueryRef.current = false
        URL.revokeObjectURL(url)
      }

      audio.onerror = (e) => {
        console.error("Audio playback error:", e)
        setVoiceState('idle')
        isVoiceQueryRef.current = false
        URL.revokeObjectURL(url)
      }

      const playPromise = audio.play()
      if (playPromise) {
        playPromise
          .then(() => console.log("Audio playing"))
          .catch(err => {
            console.error("audio.play() rejected:", err)
            setVoiceState('idle')
            isVoiceQueryRef.current = false
          })
      }
    } catch (err) {
      console.error("speakAnswer error:", err)
      setVoiceState('idle')
      isVoiceQueryRef.current = false
    }
  }

  // ── Voice: start recording ───────────────────────────────────────────────
  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })

      // Set up Web Audio analyser for silence detection + waveform visualisation
      const audioContext = new AudioContext()
      audioContextRef.current = audioContext
      const analyser = audioContext.createAnalyser()
      analyser.fftSize = 256
      analyserRef.current = analyser
      const source = audioContext.createMediaStreamSource(stream)
      source.connect(analyser)

      // Set up MediaRecorder to capture audio in chunks
      const mediaRecorder = new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data)
      }

      mediaRecorder.start(100)  // collect a chunk every 100ms
      setVoiceState('listening')
      setTranscript('')

      // Silence detection — check average volume every 100ms
      // Threshold of 8 (out of 255) may need tuning per environment/mic
      const dataArray = new Uint8Array(analyser.frequencyBinCount)

      // Gate: silence detection only arms after the user has actually spoken.
      // Prevents an accidental tap from immediately triggering processing.
      let hasSpokeRef = false

      silenceIntervalRef.current = setInterval(() => {
        analyser.getByteFrequencyData(dataArray)
        const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length

        if (avg >= 8) {
          // Sound detected — mark as spoken and reset any silence countdown
          hasSpokeRef = true
          if (silenceTimerRef.current) {
            clearTimeout(silenceTimerRef.current)
            silenceTimerRef.current = null
          }
        } else if (hasSpokeRef) {
          // Silence after speech — start countdown if not already running
          if (!silenceTimerRef.current) {
            silenceTimerRef.current = setTimeout(() => stopRecording(), 1500)
          }
        }
        // If hasSpokeRef is still false, do nothing — wait for first word
      }, 100)

    } catch (err) {
      // User denied mic or device unavailable — stay idle
      console.warn('Mic access denied or unavailable', err)
    }
  }

  // ── Voice: stop recording and transcribe ────────────────────────────────
  async function stopRecording() {
    // Clear silence detection
    if (silenceIntervalRef.current) clearInterval(silenceIntervalRef.current)
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current)
    silenceTimerRef.current = null
    silenceIntervalRef.current = null

    const mediaRecorder = mediaRecorderRef.current
    if (!mediaRecorder) return

    // Stop mic stream and close audio context
    mediaRecorder.stop()
    mediaRecorder.stream.getTracks().forEach(t => t.stop())
    audioContextRef.current?.close()
    analyserRef.current = null

    setVoiceState('processing')

    // Small delay to ensure the final chunk is delivered via ondataavailable
    setTimeout(async () => {
      const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' })

      try {
        // Send to Whisper for transcription
        const formData = new FormData()
        formData.append('audio', blob, 'recording.webm')

        const res = await fetch('http://localhost:8000/transcribe', {
          method: 'POST',
          body: formData
        })
        const { text } = await res.json()

        setTranscript(text)
        isVoiceQueryRef.current = true
        handleSearch(text)
      } catch {
        setVoiceState('idle')
        isVoiceQueryRef.current = false
      }
    }, 200)
  }

  // ── Voice: cancel at any point ───────────────────────────────────────────
  function cancelVoice() {
    if (silenceIntervalRef.current) clearInterval(silenceIntervalRef.current)
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current)
    silenceTimerRef.current = null
    silenceIntervalRef.current = null

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
      mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop())
    }

    audioContextRef.current?.close()
    analyserRef.current = null
    isVoiceQueryRef.current = false
    setVoiceState('idle')
    setTranscript('')
  }

  // ── Mic button handler — toggle between start and cancel ─────────────────
  function handleMicClick() {
    if (voiceState === 'listening') {
      cancelVoice()
    } else if (voiceState === 'idle') {
      startRecording()
    }
    // Ignore clicks during processing/speaking — don't interrupt mid-flow
  }

  return (
    /* Full-screen canvas painted in #FAFAFA so the window reads as one solid
       surface. Electron vibrancy is still active under the hood but hidden
       behind this opaque fill — matches the Claude Design light kit. */
    <div style={{
      height: '100vh',
      width: '100vw',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      background: T.bg,
      minHeight: 0,
    }}>
      <Titlebar />

      <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>
        <Sidebar activeSource={activeSource} onSourceChange={setActiveSource} />

        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
          <SearchBar
            onSearch={handleSearch}
            voiceState={voiceState}
            onMicClick={handleMicClick}
          />

          {/* Center — VoiceOverlay replaces AnswerPanel during voice interaction */}
          <div style={{
            display: 'flex',
            flex: 1,
            gap: 14,
            padding: '10px 20px 20px',
            overflow: 'hidden',
            minHeight: 0,
          }}>
            {voiceState !== 'idle' ? (
              <VoiceOverlay
                state={voiceState}
                transcript={transcript}
                analyser={analyserRef.current}
                onCancel={cancelVoice}
              />
            ) : (
              <>
                <AnswerPanel result={result} loading={loading} />
                {result && <RecentPanel history={history} onSelect={handleSearch} />}
              </>
            )}
          </div>
        </div>
      </div>

      <StatusBar backendOnline={backendOnline} count={36} />
    </div>
  )
}
