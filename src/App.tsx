import './App.css'
import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import Arborescence from "./Arborescence";

function Home() {
  return (
    <div>
      <h1>Accueil</h1>
      <p>Bienvenue sur l'application.</p>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <nav>
        <Link to="/">Accueil</Link>
        {" | "}
        <Link to="/arborescence">Arborescence</Link>
      </nav>

      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/arborescence" element={<Arborescence />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;