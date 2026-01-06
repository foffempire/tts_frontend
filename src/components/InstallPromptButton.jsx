import React from 'react'
import usePWAInstallPrompt from '../hooks/usePWAInstallPrompt'

export default function InstallPromptButton() {
  const { isInstallable, promptInstall } = usePWAInstallPrompt()

  if (!isInstallable) return null

  return (
    <button
      onClick={promptInstall}
      className="fixed bottom-4 right-4 bg-blue-600 text-white px-4 py-2 rounded-2xl shadow-lg hover:bg-blue-700 transition"
    >
      📱 Install App
    </button>
  )
}
