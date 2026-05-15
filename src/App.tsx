import { useState } from 'react'
import GameContainer from './components/GameContainer'
import DrillContainer from './components/DrillContainer'

type Screen = 'game' | 'drill'

function App() {
  const [screen, setScreen] = useState<Screen>('game')

  return (
    <div className="app-container">
      {screen === 'drill'
        ? <DrillContainer onBack={() => setScreen('game')} />
        : <GameContainer onDrill={() => setScreen('drill')} />
      }
    </div>
  )
}

export default App
