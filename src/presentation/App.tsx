import { ThemeProvider } from "next-themes";
import type { createHashRouter } from "react-router-dom";
import { RouterProvider } from "react-router-dom";
import { Toaster } from "sonner";
import { type DIContainer, DIProvider } from "@/di/DIContext";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { StreamServerProvider } from "./context/StreamServerContext";
import { TorrentStatusProvider } from "./context/TorrentStatusContext";
import "./App.css";

interface AppProps {
  router: ReturnType<typeof createHashRouter>;
  diContainer: DIContainer;
}

export default function App({ router, diContainer }: AppProps) {
  return (
    <ErrorBoundary>
      <DIProvider value={diContainer}>
        <StreamServerProvider>
          <TorrentStatusProvider>
            <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
              <RouterProvider router={router} />
              <Toaster
                position="top-center"
                richColors
                expand={false}
                duration={3000}
                mobileOffset={"calc(env(safe-area-inset-top, 0px) + 1.5rem)"}
              />
            </ThemeProvider>
          </TorrentStatusProvider>
        </StreamServerProvider>
      </DIProvider>
    </ErrorBoundary>
  );
}
