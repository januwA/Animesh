import ReactDOM from "react-dom/client";
import { createHashRouter } from "react-router-dom";
import { createDefaultDIContainer } from "./di/DIContext";
import App from "./presentation/App";
import {
	applyAccent,
	getStoredAccent,
} from "./presentation/hooks/useAccentTheme";
import { routes } from "./presentation/routes";

applyAccent(getStoredAccent());

const router = createHashRouter(routes);

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
	<App router={router} diContainer={createDefaultDIContainer()} />,
);
