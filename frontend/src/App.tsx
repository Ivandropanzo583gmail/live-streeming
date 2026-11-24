import { BrowserRouter, Route, Routes } from 'react-router-dom';
import BroadCast from './pages/Broadcast';
import WatchPages from './pages/Watch';



export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<BroadCast />} />
        <Route path="/watch/:slug" element={<WatchPages />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;