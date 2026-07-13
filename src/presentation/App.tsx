import { ThemeProvider } from "next-themes";
import type { createHashRouter } from "react-router-dom";
import { RouterProvider } from "react-router-dom";
import { type DIContainer, DIProvider } from "@/di/DIContext";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { AppContextProvider } from "./context/AppContext";
import "./App.css";

interface AppProps {
	router: ReturnType<typeof createHashRouter>;
	diContainer: DIContainer;
}

export default function App({ router, diContainer }: AppProps) {
	return (
		<ErrorBoundary>
			<DIProvider value={diContainer}>
				<AppContextProvider>
					<ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
						<RouterProvider router={router} />
					</ThemeProvider>
				</AppContextProvider>
			</DIProvider>
		</ErrorBoundary>
	);
}
