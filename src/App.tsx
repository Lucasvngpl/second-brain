import { useState, useRef } from "react"
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
    setVoiceState('speaking')

    try {
      const res = await fetch("http://localhost:8000/speak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text })
      })

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const audio = new Audio(url)

      // Return to results view when audio finishes
      audio.onended = () => {
        setVoiceState('idle')
        isVoiceQueryRef.current = false
        URL.revokeObjectURL(url)
      }

      audio.play()
    } catch {
      // If speaking fails just return to results silently
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
    /* Full-screen canvas — bg-transparent lets Electron vibrancy show through */
    <div className="h-screen w-screen overflow-hidden relative bg-transparent">

      {/* THE ONE BIG GLASS CARD — edge-to-edge, macOS handles rounding via roundedCorners */}
      <div className="absolute inset-0 flex flex-col overflow-hidden" style={{ background: 'rgba(0,0,0,0.08)' }}>

        {/* Main row: sidebar + content */}
        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar — drag region at top clears macOS traffic lights */}
          <Sidebar activeSource={activeSource} onSourceChange={setActiveSource} />

          <div className="flex flex-col flex-1 min-w-0" style={{ paddingTop: '28px' }}>
            <div style={{ marginTop: '8px' }}>
              <SearchBar
                onSearch={handleSearch}
                loading={loading}
                voiceState={voiceState}
                onMicClick={handleMicClick}
              />
            </div>

            {/* Center area — VoiceOverlay replaces AnswerPanel during voice interaction */}
            <div className="flex flex-1 gap-4 p-5 overflow-hidden">
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
                  <RecentPanel history={history} onSelect={handleSearch} />
                </>
              )}
            </div>
          </div>
        </div>

        {/* Status bar — 28px live system readout at window bottom */}
        <StatusBar backendOnline={backendOnline} />
      </div>
    </div>
  )
}
