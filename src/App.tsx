import { lazy, Suspense, useEffect } from "react";
import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";
import { ChainProvider } from "./hooks/useChain";
import { useScrollReveal } from "./hooks/useScrollReveal";
import { Nav } from "./components/Nav/Nav";
import { ModeBanner } from "./components/ModeBanner/ModeBanner";
import { Footer } from "./components/Footer/Footer";
import { Loading } from "./components/Loading/Loading";
import Landing from "./pages/Landing/Landing";
const Market = lazy(() => import("./pages/Market/Market"));
const WritDetail = lazy(() => import("./pages/WritDetail/WritDetail"));
const Wrap = lazy(() => import("./pages/Wrap/Wrap"));
const Gallery = import.meta.env.DEV
  ? lazy(() => import("./pages/Gallery/Gallery"))
  : null;
function Scroll() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (hash) {
      requestAnimationFrame(() =>
        document.getElementById(hash.slice(1))?.scrollIntoView(),
      );
    } else window.scrollTo(0, 0);
  }, [pathname, hash]);
  return null;
}
function NotFound() {
  useEffect(() => {
    document.title = "Page not found — Writ";
  }, []);
  return (
    <div className="appContainer" style={{ paddingBlock: 80 }}>
      <h1>That page doesn’t exist.</h1>
      <a href="/">Return to Writ</a>
    </div>
  );
}
function Layout() {
  useScrollReveal();
  return (
    <ChainProvider>
      <Scroll />
      <a href="#main" className="skipLink">
        Skip to content
      </a>
      <Nav />
      <ModeBanner />
      <main id="main">
        <Suspense
          fallback={
            <div className="appContainer">
              <Loading label="Opening Writ…" />
            </div>
          }
        >
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/market" element={<Market />} />
            <Route path="/app" element={<Market mine />} />
            <Route path="/writ/:id" element={<WritDetail />} />
            <Route path="/wrap" element={<Wrap />} />
            {Gallery && <Route path="/__gallery" element={<Gallery />} />}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </main>
      <Footer />
    </ChainProvider>
  );
}
export default function App() {
  return (
    <BrowserRouter>
      <Layout />
    </BrowserRouter>
  );
}
