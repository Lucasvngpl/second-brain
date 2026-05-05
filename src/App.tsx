import { useState, useRef } from "react"
import { T } from "./components/ui"
import Titlebar from "./components/Titlebar.tsx"
import Sidebar from "./components/Sidebar"
import SearchBar from "./components/SearchBar.tsx"
import AnswerPanel from "./components/AnswerPanel.tsx"
import RecentPanel from "./components/RecentPanel.tsx"
import StatusBar from "./components/StatusBar.tsx"
import VoiceOverlay from "./components/VoiceOverlay.tsx"
import { useStats } from "./lib/stats"

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

export type VoiceState = 'idle' | 'listening' | 'processing' | 'speaking'

export default function App() {
  const [result, setResult] = useState<SearchResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [history, setHistory] = useState<string[]>([])
  const [activeSource, setActiveSource] = useState("all")
  const [backendOnline, setBackendOnline] = useState(true)

  // Live dashboard readouts. Re-fires when backendOnline flips back to true so
  // the dashboard catches up the moment the backend comes back.
  const stats = useStats(backendOnline)

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
  // Tracks the currently-playing Bella audio so we can pause it mid-sentence
  // when the user opts out of conversation mode.
  const currentAudioRef = useRef<HTMLAudioElement | null>(null)

  // ── Search ───────────────────────────────────────────────────────────────
  async function handleSearch(query: string) {
    if (!query.trim()) return
    setLoading(true)
    setHistory(prev => [query, ...prev.slice(0, 9)])

    try {
      const res = await fetch("http://localhost:8000/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: query,
          source: activeSource === "all" ? null : activeSource,
          // Tells the backend to keep the answer short enough that TTS
          // doesn't run for a minute. Read once here so a follow-up
          // typed query doesn't accidentally inherit voice brevity.
          voice: isVoiceQueryRef.current,
        })
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
      currentAudioRef.current = audio

      console.log("Audio created, attempting play")

      // Continuous conversation: when Bella finishes, re-open the mic so the
      // user can ask a follow-up without tapping. isVoiceQueryRef stays true
      // so the next answer is also spoken. Exit by tapping mic in 'listening'
      // (cancelVoice) or by tapping "view as text" in the overlay (exitToText).
      audio.onended = () => {
        URL.revokeObjectURL(url)
        currentAudioRef.current = null
        startRecording()
      }

      audio.onerror = (e) => {
        console.error("Audio playback error:", e)
        setVoiceState('idle')
        isVoiceQueryRef.current = false
        URL.revokeObjectURL(url)
        currentAudioRef.current = null
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
      // Echo cancellation subtracts speaker output from the mic signal, so
      // Bella's voice doesn't get re-transcribed when the user asks a follow-up.
      // Noise suppression and AGC clean up cafe/keyboard noise + level swings.
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      })

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
      // User denied mic or device unavailable — fall back to idle so the
      // orb resets (matters for the continuous-conversation auto-restart,
      // which lands here if the OS revokes permission mid-session).
      console.warn('Mic access denied or unavailable', err)
      setVoiceState('idle')
      isVoiceQueryRef.current = false
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

    // Stop Bella mid-sentence if she's still talking. Without this the audio
    // keeps playing in the background even after the overlay closes.
    if (currentAudioRef.current) {
      currentAudioRef.current.pause()
      currentAudioRef.current = null
    }

    audioContextRef.current?.close()
    analyserRef.current = null
    isVoiceQueryRef.current = false
    setVoiceState('idle')
    setTranscript('')
  }

  // Leave conversation mode but keep the result on screen. Same teardown as
  // cancelVoice — only difference is intent: cancelVoice abandons mid-query,
  // exitToText is the "I have my answer, show me the written version" exit.
  function exitToText() {
    cancelVoice()
  }

  // Reset back to the empty-state dashboard. Recent history is preserved so
  // the user can reopen prior queries from the recent panel.
  function goHome() {
    if (voiceState !== 'idle') cancelVoice()
    setResult(null)
    setActiveSource('all')
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
        <Sidebar
          activeSource={activeSource}
          onSourceChange={setActiveSource}
          counts={stats?.by_source ?? {}}
          onHome={goHome}
        />

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
                photos={result?.sources.filter(s => s.source === 'photos') ?? []}
                onCancel={cancelVoice}
                onExitToText={exitToText}
                hasResult={result !== null}
              />
            ) : (
              <>
                <AnswerPanel
                  result={result}
                  loading={loading}
                  stats={stats}
                  backendOnline={backendOnline}
                  voiceState={voiceState}
                  onPromptSelect={handleSearch}
                />
                {result && <RecentPanel history={history} onSelect={handleSearch} />}
              </>
            )}
          </div>
        </div>
      </div>

      <StatusBar
        backendOnline={backendOnline}
        count={stats?.total ?? 0}
        lastSyncedSource={stats?.latest?.source ?? null}
      />
    </div>
  )
}
