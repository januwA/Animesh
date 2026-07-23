import ReactDOM from "react-dom/client";
import { createHashRouter } from "react-router-dom";
import { createDefaultDIContainer } from "./di/DIContext";
import App from "./presentation/App";
import { routes } from "./presentation/routes";

const router = createHashRouter(routes);

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
	<App router={router} diContainer={createDefaultDIContainer()} />,
);
