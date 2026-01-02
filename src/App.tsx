import { AudioProvider } from './audio/AudioProvider'
import { CyberVoid } from './components/CyberVoid'
import { HUD } from './components/HUD'

function App() {
  return (
    <AudioProvider>
      <div className="relative w-full h-full bg-void">
        <CyberVoid />
        <HUD />
      </div>
    </AudioProvider>
  )
}

export default App
