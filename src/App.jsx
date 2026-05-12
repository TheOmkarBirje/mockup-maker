import { useState } from 'react';
import './App.css';
import Generator from './components/Generator';
import DualGenerator from './components/DualGenerator';

const GW_MOCKUPS = [
  { id: 'Mockup-1-Light-Mode.svg', name: 'Light Mode' },
  { id: 'Mockup-1-Dark-Mode.svg', name: 'Dark Mode' },
  { id: 'Mockup-1-Blank-Light-Mode.svg', name: 'Blank Light' },
  { id: 'Mockup-1-Blank-Dark-Mode.svg', name: 'Blank Dark' },
];

const WS_MOCKUPS = [
  { id: 'Mockup-2-Light-Mode.svg', name: 'Light Mode' },
  { id: 'Mockup-2-Dark-Mode.svg', name: 'Dark Mode' },
  { id: 'Mockup-2-Blank-Light-Mode.svg', name: 'Blank Light' },
  { id: 'Mockup-2-Blank-Dark-Mode.svg', name: 'Blank Dark' },
];

function App() {
  const [activeTab, setActiveTab] = useState('GW');

  return (
    <div className="app-container animate-fade-in">
      <div className="tab-switcher">
        <button 
          className={`tab-btn ${activeTab === 'GW' ? 'active' : ''}`}
          onClick={() => setActiveTab('GW')}
        >
          GW Mockup
        </button>
        <button 
          className={`tab-btn ${activeTab === 'WS' ? 'active' : ''}`}
          onClick={() => setActiveTab('WS')}
        >
          WS Mockup
        </button>
        <button 
          className={`tab-btn ${activeTab === 'COMBINED' ? 'active' : ''}`}
          onClick={() => setActiveTab('COMBINED')}
        >
          Combined Mockup
        </button>
      </div>

      <div className="tab-content">
        {activeTab === 'GW' && <Generator basePath="GW" mockups={GW_MOCKUPS} />}
        {activeTab === 'WS' && <Generator basePath="WS" mockups={WS_MOCKUPS} />}
        {activeTab === 'COMBINED' && <DualGenerator />}
      </div>
    </div>
  );
}

export default App;
