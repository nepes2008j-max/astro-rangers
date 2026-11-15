import { useEffect } from 'react'
import { connectAudio } from './lib/audio.js'
import { useGameStore } from './store/useGameStore.js'
import Welcome from './components/Welcome.jsx'
import MissionMap from './components/MissionMap.jsx'
import Dashboard from './components/Dashboard.jsx'
import EndScreen from './components/EndScreen.jsx'
import BaseShop from './components/BaseShop.jsx'

const screens = { welcome: Welcome, map: MissionMap, game: Dashboard, end: EndScreen, shop: BaseShop }

export default function App() {
  const screen = useGameStore((s) => s.screen)
  const loadSpaceWeather = useGameStore((s) => s.loadSpaceWeather)
  useEffect(() => { loadSpaceWeather() }, [loadSpaceWeather])
  useEffect(() => connectAudio(useGameStore), []) // music + sound effects follow game state
  const Screen = screens[screen]
  return (
    <main className="min-h-dvh bg-[radial-gradient(ellipse_at_top,#1e1b4b,#020617_60%)] px-4 py-6">
      <Screen />
    </main>
  )
}
