import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import Arborescence from "./Arborescence";
import { DocumentEditor } from "./components/editor";

function Home() {
    return (
        <div>
            <h1>
                Accueil
            </h1>
            <p>
                Bienvenue sur l'application.
            </p>
        </div>
    );
}

function EditorPage() {
    return (
        <div className="mx-auto max-w-5xl">
            <header className="mb-6">
                <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
                    Éditeur de document
                </h1>
                <p className="mt-2 text-sm text-slate-500">
                    Édition locale · Le contenu est perdu en quittant cette page ou en la rechargeant.
                </p>
            </header>
            <DocumentEditor />
        </div>
    );
}

function App() {
    return (
        <BrowserRouter>
            <nav aria-label="Navigation principale" className="flex flex-wrap gap-5 border-b border-slate-200 bg-white px-6 py-4 text-sm font-medium text-indigo-700">
                <Link to="/">
                    Accueil
                </Link>
                <Link to="/arborescence">
                    Arborescence
                </Link>
                <Link to="/editor">
                    Éditeur
                </Link>
            </nav>

            <main className="px-4 py-8 sm:px-8">
                <Routes>
                    <Route path="/" element={<Home />} />
                    <Route path="/arborescence" element={<Arborescence />} />
                    <Route path="/editor" element={<EditorPage />} />
                </Routes>
            </main>
        </BrowserRouter>
    );
}

export default App;
