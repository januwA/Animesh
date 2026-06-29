import type { createHashRouter } from "react-router-dom";
import { RouterProvider } from "react-router-dom";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { AppContextProvider } from "./context/AppContext";
import { type DIContainer, DIProvider } from "./di/DIContext";
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
					<RouterProvider router={router} />
				</AppContextProvider>
			</DIProvider>
		</ErrorBoundary>
	);
}
