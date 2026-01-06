// App.jsx
import React, { useState, useRef, useEffect } from "react";
import InstallPromptButton from "./components/InstallPromptButton";
import logo from "./assets/logo.png";

const App = () => {
  const [sessionId, setSessionId] = useState(null);
  const [pdfText, setPdfText] = useState("");
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentPosition, setCurrentPosition] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [speechRate, setSpeechRate] = useState(1.0);
  const [pitch, setPitch] = useState(1.0);
  const [voice, setVoice] = useState(null);
  const [voices, setVoices] = useState([]);

  const speechSynthesisRef = useRef(null);
  const utteranceRef = useRef(null);

  // Initialize speech synthesis and load voices
  useEffect(() => {
    speechSynthesisRef.current = window.speechSynthesis;

    const loadVoices = () => {
      const availableVoices = speechSynthesisRef.current.getVoices();
      setVoices(availableVoices);
      if (availableVoices.length > 0) {
        setVoice(availableVoices[0]);
      }
    };

    // Load voices when they become available
    speechSynthesisRef.current.onvoiceschanged = loadVoices;
    loadVoices();

    // Cleanup on unmount
    return () => {
      if (speechSynthesisRef.current) {
        speechSynthesisRef.current.cancel();
      }
    };
  }, []);

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.type.includes("pdf")) {
      setError("Please upload a PDF file");
      return;
    }

    setIsLoading(true);
    setError("");

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("http://localhost:8000/upload-pdf", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Failed to upload PDF");
      }

      const data = await response.json();
      setSessionId(data.session_id);
      setPdfText(data.text);
      setCurrentPosition(0);
      setSpeechRate(data.speech_rate || 1.0);
      setPitch(data.pitch || 1.0);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const updateSpeechSettings = async (newRate, newPitch) => {
    if (!sessionId) return;

    try {
      const response = await fetch(
        `http://localhost:8000/session/${sessionId}/speech-settings`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            speech_rate: newRate,
            pitch: newPitch,
          }),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to update speech settings");
      }
    } catch (err) {
      console.error("Error updating speech settings:", err);
    }
  };

  const handleSpeedChange = (newRate) => {
    handleStop();
    const rate = parseFloat(newRate);
    setSpeechRate(rate);
    updateSpeechSettings(rate, pitch);

    // Update current utterance if playing
    if (isPlaying && utteranceRef.current) {
      utteranceRef.current.rate = rate;
    }
  };

  const handlePitchChange = (newPitch) => {
    handleStop();
    const pitchValue = parseFloat(newPitch);
    setPitch(pitchValue);
    updateSpeechSettings(speechRate, pitchValue);

    // Update current utterance if playing
    if (isPlaying && utteranceRef.current) {
      utteranceRef.current.pitch = pitchValue;
    }
  };

  const handleVoiceChange = (event) => {
    const selectedVoice = voices.find((v) => v.name === event.target.value);
    setVoice(selectedVoice);
  };

  const speak = (text, position = 0) => {
    if (!speechSynthesisRef.current) return;

    const textToSpeak = text.slice(position);

    // Cancel any ongoing speech
    speechSynthesisRef.current.cancel();

    // Create new utterance
    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    utteranceRef.current = utterance;

    // Set speech properties
    utterance.rate = speechRate;
    utterance.pitch = pitch;
    utterance.volume = 1.0;

    if (voice) {
      utterance.voice = voice;
    }

    // Update position as speech progresses
    let lastPosition = position;
    utterance.onboundary = (event) => {
      if (event.name === "word") {
        const newPosition = position + event.charIndex;
        setCurrentPosition(newPosition);
        lastPosition = newPosition;

        // Update position in backend
        if (sessionId) {
          fetch(`http://localhost:8000/session/${sessionId}/position`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ position: newPosition }),
          });
        }
      }
    };

    utterance.onend = () => {
      setIsPlaying(false);
      setCurrentPosition(pdfText.length);
    };

    utterance.onerror = (event) => {
      console.error("Speech synthesis error:", event);
      setIsPlaying(false);
      setError("Error during speech synthesis");
    };

    speechSynthesisRef.current.speak(utterance);
    setIsPlaying(true);
  };

  const handlePlay = () => {
    if (!pdfText) return;

    if (isPlaying) {
      handlePause();
    } else {
      speak(pdfText, currentPosition);
    }
  };

  const handlePause = () => {
    if (speechSynthesisRef.current) {
      speechSynthesisRef.current.pause();
      setIsPlaying(false);
    }
  };

  const handleResume = () => {
    if (speechSynthesisRef.current) {
      speechSynthesisRef.current.resume();
      setIsPlaying(true);
    }
  };

  const handleStop = () => {
    if (speechSynthesisRef.current) {
      speechSynthesisRef.current.cancel();
      setIsPlaying(false);
      setCurrentPosition(0);

      // Reset position in backend
      if (sessionId) {
        fetch(`http://localhost:8000/session/${sessionId}/position`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ position: 0 }),
        });
      }
    }
  };

  const handleSeek = (newPosition) => {
    setCurrentPosition(newPosition);

    if (isPlaying) {
      handleStop();
      setTimeout(() => speak(pdfText, newPosition), 100);
    }

    // Update position in backend
    if (sessionId) {
      fetch(`http://localhost:8000/session/${sessionId}/position`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ position: newPosition }),
      });
    }
  };

  // Load session on component mount
  useEffect(() => {
    const loadSession = async () => {
      const savedSessionId = localStorage.getItem("pdf_tts_session");
      if (savedSessionId) {
        try {
          const response = await fetch(
            `http://localhost:8000/session/${savedSessionId}`
          );
          if (response.ok) {
            const data = await response.json();
            setSessionId(savedSessionId);
            setPdfText(data.text);
            setCurrentPosition(data.current_position);
            setSpeechRate(data.speech_rate || 1.0);
            setPitch(data.pitch || 1.0);
          }
        } catch (err) {
          console.error("Failed to load session:", err);
          localStorage.removeItem("pdf_tts_session");
        }
      }
    };

    loadSession();
  }, []);

  // Save session to localStorage
  useEffect(() => {
    if (sessionId) {
      localStorage.setItem("pdf_tts_session", sessionId);
    }
  }, [sessionId]);

  const progress = pdfText ? (currentPosition / pdfText.length) * 100 : 0;

  return (
    <div className="min-h-screen bg-gray-100 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="flex items-center justify-center gap-3">
          <img src={logo} alt="" className="w-9" />
          <span className="text-2xl font-bold text-center text-gray-800">
            PDF Aloud
          </span>
        </div>
        <h1 className="text-center text-gray-800 mb-8 py-7">
          A portable PDF Text-to-Speech Reader
        </h1>

        {/* File Upload */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex items-center justify-center w-full">
            <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100">
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                <svg
                  className="w-8 h-8 mb-4 text-gray-500"
                  aria-hidden="true"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 20 16"
                >
                  <path
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M13 13h3a3 3 0 0 0 0-6h-.025A5.56 5.56 0 0 0 16 6.5 5.5 5.5 0 0 0 5.207 5.021C5.137 5.017 5.071 5 5 5a4 4 0 0 0 0 8h2.167M10 15V6m0 0L8 8m2-2 2 2"
                  />
                </svg>
                <p className="mb-2 text-sm text-gray-500">
                  <span className="font-semibold">Click to upload</span>
                </p>
                <p className="text-xs text-gray-500">PDF files only</p>
              </div>
              <input
                type="file"
                className="hidden"
                accept=".pdf"
                onChange={handleFileUpload}
                disabled={isLoading}
              />
            </label>
          </div>
        </div>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        {isLoading && (
          <div className="text-center py-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-2 text-gray-600">Processing PDF...</p>
          </div>
        )}

        {/* Speech Controls */}
        {pdfText && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4 mb-9">
              {/* Speed Control */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Speed: {speechRate.toFixed(1)}x
                </label>
                <div className="flex items-center space-x-2">
                  <span className="text-xs text-gray-500">0.5x</span>
                  <input
                    type="range"
                    min="0.5"
                    max="2"
                    step="0.1"
                    value={speechRate}
                    onChange={(e) => handleSpeedChange(e.target.value)}
                    className="w-full border-b border-blue-300"
                  />
                  <span className="text-xs text-gray-500">2x</span>
                </div>
              </div>

              {/* Pitch Control */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Pitch: {pitch.toFixed(1)}
                </label>
                <div className="flex items-center space-x-2">
                  <span className="text-xs text-gray-500">Low</span>
                  <input
                    type="range"
                    min="0.5"
                    max="2"
                    step="0.1"
                    value={pitch}
                    onChange={(e) => handlePitchChange(e.target.value)}
                    className="w-full border-b border-blue-300"
                  />
                  <span className="text-xs text-gray-500">High</span>
                </div>
              </div>
            </div>

            {/* Playback Controls */}
            <div className="flex justify-center space-x-4 mb-4">
              <button
                onClick={handlePlay}
                disabled={!pdfText}
                className={`px-6 py-2 rounded-lg font-medium ${
                  isPlaying
                    ? "bg-yellow-500 hover:bg-yellow-600 text-white"
                    : "bg-green-500 hover:bg-green-600 text-white"
                } disabled:bg-gray-300 disabled:cursor-not-allowed`}
              >
                {isPlaying ? "Pause" : "Play"}
              </button>

              {!isPlaying && currentPosition > 0 && (
                <button
                  onClick={handleResume}
                  className="px-6 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium"
                >
                  Resume
                </button>
              )}

              <button
                onClick={handleStop}
                disabled={!pdfText}
                className="px-6 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                Stop
              </button>
            </div>

            {/* Progress Bar */}
            <div className="mt-4">
              <div className="flex justify-between text-sm text-gray-600 mb-2">
                <span>Progress</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                ></div>
              </div>

              {/* Seek Slider */}
              <input
                type="range"
                min="0"
                max={pdfText.length}
                value={currentPosition}
                onChange={(e) => handleSeek(parseInt(e.target.value))}
                className="w-full mt-4"
              />
            </div>
          </div>
        )}

        {/* Text Preview */}
        {pdfText && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4">Text Preview</h2>
            <div className="max-h-96 overflow-y-auto border border-gray-200 rounded-lg p-4">
              <p className="text-gray-700 whitespace-pre-wrap">
                <span className="text-gray-400">
                  {pdfText.slice(0, currentPosition)}
                </span>
                <span className="bg-yellow-200">
                  {pdfText.slice(currentPosition, currentPosition + 50)}
                </span>
                {pdfText.slice(currentPosition + 50)}
              </p>
            </div>
          </div>
        )}
      </div>
      <InstallPromptButton />
    </div>
  );
};

export default App;
