import { useState } from 'react'
import { GameProvider } from './engine/store'
import { CharacterScreen } from './components/CharacterScreen'
import { DashboardScreen } from './components/DashboardScreen'

type Tab = 'character' | 'dashboard'

function App() {
  const [tab, setTab] = useState<Tab>('character')

  return (
    <GameProvider>
      <div className="min-h-screen pb-16">
        {tab === 'character' ? <CharacterScreen /> : <DashboardScreen />}

        <nav className="fixed bottom-0 inset-x-0 bg-slate-950/95 backdrop-blur border-t border-slate-800 flex max-w-md mx-auto left-0 right-0">
          <button
            onClick={() => setTab('character')}
            className={`flex-1 py-3 text-sm font-medium ${tab === 'character' ? 'text-violet-400' : 'text-slate-500'}`}
          >
            🧝 Персонаж
          </button>
          <button
            onClick={() => setTab('dashboard')}
            className={`flex-1 py-3 text-sm font-medium ${tab === 'dashboard' ? 'text-violet-400' : 'text-slate-500'}`}
          >
            📊 Дашборд
          </button>
        </nav>
      </div>
    </GameProvider>
  )
}

export default App
